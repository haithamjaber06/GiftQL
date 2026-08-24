from pydantic import BaseModel, field_validator

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
    price: float | None = None
    occasion: str | None = None

    @field_validator("price")
    @classmethod
    def round_price(cls, value):
        return value if value is None else round(value, 2)
