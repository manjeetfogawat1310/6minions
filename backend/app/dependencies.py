from collections.abc import Generator

from fastapi import Depends
from sqlalchemy.orm import Session

from app.database import get_db


def database_session() -> Generator[Session, None, None]:
    yield from get_db()


DBSession = Depends(database_session)
