from fastapi import FastAPI, Depends
from .auth import router as auth_router
from .deps import get_current_user
from .models import UserOut

app = FastAPI(title="Simple FastAPI Auth")

app.include_router(auth_router)

@app.get("/")
async def root():
    return {"ok": True}

@app.get("/protected", response_model=UserOut)
async def protected(current_user = Depends(get_current_user)):
    return current_user
