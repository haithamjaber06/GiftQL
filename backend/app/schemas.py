import re
from typing import Literal

from pydantic import BaseModel, field_validator, model_validator, Field

KIND = Literal["Product", "Store", "Idea", "Inspo"]

# Same shape as the items.currency_iso constraint (migration 0002).
CURRENCY_CODE = re.compile(r"[A-Z]{3}")


def clean_currency(value: str | None) -> str | None:
    """Trimmed and uppercased; None if blank or not a three-letter code."""
    if value is None:
        return None
    value = value.strip().upper()
    return value if CURRENCY_CODE.fullmatch(value) else None


def strict_currency(value: str | None) -> str | None:
    """Like clean_currency, but rejects a non-blank value that isn't a code."""
    if value is None or not value.strip():
        return None
    cleaned = clean_currency(value)
    if cleaned is None:
        raise ValueError("currency must be a three-letter code, e.g. JOD")
    return cleaned


def check_pair(price: float | None, currency: str | None) -> None:
    """Mirrors the items.price_currency_pair constraint: both or neither."""
    if (price is None) != (currency is None):
        raise ValueError("price and currency must be given together")


#Checks Incoming Data
class NewItem(BaseModel):
    url: str
    person: str = ""
    occasion: str=""
    price: float | None = None
    currency: str | None = None
    
    @field_validator("price")
    @classmethod
    def round_price(cls, value):
        return value if value is None else round(value, 2)

    @field_validator("currency")
    @classmethod
    def check_currency(cls, value):
        return strict_currency(value)

    @model_validator(mode="after")
    def price_with_currency(self):
        check_pair(self.price, self.currency)
        return self


class ItemUpdate(BaseModel):
    title: str | None = None
    kind: KIND | None = None
    price: float | None = None
    currency: str | None = None
    occasion: str | None = None

    @field_validator("price")
    @classmethod
    def round_price(cls, value):
        return value if value is None else round(value, 2)

    @field_validator("currency")
    @classmethod
    def check_currency(cls, value):
        return strict_currency(value)

    @model_validator(mode="after")
    def price_with_currency(self):
        # A PATCH touching either one must send both, so the stored pair stays whole.
        sent = {"price", "currency"} & self.model_fields_set
        if sent and sent != {"price", "currency"}:
            raise ValueError("price and currency must be sent together")
        if sent:
            check_pair(self.price, self.currency)
        return self

class ItemParse(BaseModel):
    """What the LLM is allowed to tell us about the saved link."""
    
    kind: KIND = Field(
        description="One of: Product, Store, Idea, Inspo. A single buyable thing is a 'product'. " 
                    "A shop you'd return to is 'store'"
    )
    
    title: str = Field(
        description="The product's real name, as a person would say it out loud. "
                    "Strip marketing keywords, feature lists, bracketed warranty or "
                    "version notes, and the seller's SEO padding. Keep a distinguishing "
                    "variant (colour, size, model) only if it changes what the gift is. "
                    "Aim for under 60 characters. "
                    "Example: 'SAMSUNG Galaxy Buds 2 Pro True Wireless Bluetooth Earbuds, "
                    "Noise Cancelling, Hi-Fi Sound, Graphite [US Version, 1Yr Warranty]' "
                    "-> 'Galaxy Buds 2 Pro, Graphite'"
    )
    
    description: str | None = Field(
        default=None,
        description="One sentence on what it is."
    )
    
    price: float | None = Field(
        default=None,
        description="The numeric price if one is clearly stated on the page. "
                    "Null if you are not certain. Never estimate."
    )
    
    currency: str | None = Field(
        default=None,
        description="Three-letter code, e.g. JOD, USD. Null if no price."
    )

    @field_validator("currency")
    @classmethod
    def drop_bad_currency(cls, value):
        return clean_currency(value)

    @model_validator(mode="after")
    def keep_only_pairs(self):
        # An unpaired price or currency can't be stored (price_currency_pair), so drop it.
        if self.price is None or self.currency is None:
            self.price = None
            self.currency = None
        return self
    
    labels: list[str] = Field(
        default_factory=list,
        description="2-5 short lowercase tags describing the vibe or category. "
                    "e.g. ['woodworking', 'handmade', 'desk']"
    )