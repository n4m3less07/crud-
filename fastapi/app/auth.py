from fastapi import APIRouter, HTTPException, status
from fastapi import Body
from .models import RegisterIn, LoginIn, UserOut
from .db import users_coll
import bcrypt
import os
import jwt
from datetime import datetime, timedelta
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY", "supersecret")
ALGO = "HS256"
EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

router = APIRouter(prefix="/auth", tags=["auth"])

def create_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGO)
    return token

@router.post("/register", response_model=UserOut, status_code=201)
async def register(payload: RegisterIn = Body(...)):
    existing = await users_coll.find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode()
    user_doc = {
        "email": payload.email,
        "hashed_password": hashed,
        "full_name": payload.full_name,
        "created_at": datetime.utcnow()
    }
    res = await users_coll.insert_one(user_doc)
    created = await users_coll.find_one({"_id": res.inserted_id})
    created["_id"] = str(created["_id"])
    return created

@router.post("/login")
async def login(payload: LoginIn = Body(...)):
    user = await users_coll.find_one({"email": payload.email})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    hashed = user.get("hashed_password")
    if not hashed or not bcrypt.checkpw(payload.password.encode(), hashed.encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_token(str(user["_id"]))
    return {"access_token": token, "token_type": "bearer"}
