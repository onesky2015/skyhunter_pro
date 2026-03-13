from typing import Optional
from sqlmodel import Session
from db import engine
from models.database import TransactionHistory, User

def _record_transaction(
    user_id: int, transaction_type: str, amount: int,
    credits_before: int, credits_after: int,
    description: Optional[str] = None,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    operator_user_id: Optional[int] = None,
):
    with Session(engine) as session:
        record = TransactionHistory(
            user_id=user_id, transaction_type=transaction_type, amount=amount,
            credits_before=credits_before, credits_after=credits_after,
            description=description, reference_type=reference_type,
            reference_id=reference_id, operator_user_id=operator_user_id
        )
        session.add(record)
        session.commit()

def _refund_user_credits(user_id: int, amount: int, reason: str):
    with Session(engine) as session:
        user = session.get(User, user_id)
        if user:
            credits_before = user.credits
            user.credits += amount
            session.add(user)
            session.commit()
            _record_transaction(
                user_id=user.id, transaction_type="refund", amount=amount,
                credits_before=credits_before, credits_after=user.credits,
                description=f"Refund: {reason}"
            )
