from pydantic import BaseModel, EmailStr, Field, constr
from typing import Optional

class RegisterIn(BaseModel):
    email: EmailStr
    password: constr(min_length=6)
    full_name: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str = Field(..., alias="_id")
    email: EmailStr
    full_name: Optional[str] = None
