from pydantic import BaseModel, field_validator, Field

#Checks Incoming Data
class NewItem(BaseModel):
    url: str
    person: str = ""
    occasion: str=""
    price: float | None = None
    
    @field_validator("price")
    @classmethod
    def round_price(cls, value):
        return value if value is None else round(value, 2)
class ItemUpdate(BaseModel):
    title: str | None = None
    kind: str | None = None
    price: float | None = None
    occasion: str | None = None

    @field_validator("price")
    @classmethod
    def round_price(cls, value):
        return value if value is None else round(value, 2)

class ItemParse(BaseModel):
    """What the LLM is allowed to tell us about the saved link."""
    
    kind: str = Field(
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
    
    labels: list[str] = Field(
        default_factory=list,
        description="2-5 short lowercase tags describing the vibe or category. "
                    "e.g. ['woodworking', 'handmade', 'desk']"
    )