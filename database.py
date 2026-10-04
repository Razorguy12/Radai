from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Text, text
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
import datetime

load_dotenv()

# Use the DATABASE_URL from .env. If not set, raise an error or fallback to a default.
# The user asked for postgresql, so we expect something like:
# postgresql://user:password@localhost:5432/radiology_db
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

if not SQLALCHEMY_DATABASE_URL:
    # We fallback to sqlite for testing purposes if they haven't set the postgres URL yet
    print("WARNING: DATABASE_URL not found in environment, falling back to sqlite")
    SQLALCHEMY_DATABASE_URL = "sqlite:///./radiology.db"
    
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_admin = Column(Boolean, default=False)
    
    reports = relationship("Report", back_populates="user")

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    patient_id = Column(String, index=True)
    patient_name = Column(String)
    modality = Column(String)
    status = Column(String, default="draft")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    report_data = Column(Text)  # JSON string of the complete report
    input_params = Column(Text, nullable=True)  # JSON string of original form inputs
    scan_image = Column(Text, nullable=True)  # Base64 or URL of uploaded scan image
    scan_image_name = Column(String, nullable=True)  # Original filename

    user = relationship("User", back_populates="reports")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations(db_engine):
    """Add new columns to existing reports table if missing."""
    is_sqlite = db_engine.dialect.name == "sqlite"
    timestamp_type = "DATETIME" if is_sqlite else "TIMESTAMP"

    new_columns = [
        ("status", f"VARCHAR DEFAULT 'draft'"),
        ("updated_at", timestamp_type),
        ("input_params", "TEXT"),
        ("scan_image", "TEXT"),
        ("scan_image_name", "VARCHAR"),
    ]

    with db_engine.connect() as conn:
        if is_sqlite:
            existing = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(reports)")).fetchall()
            }
        else:
            rows = conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = 'reports'"
                )
            ).fetchall()
            existing = {row[0] for row in rows}

        for col_name, col_type in new_columns:
            if col_name in existing:
                continue
            conn.execute(text(f"ALTER TABLE reports ADD COLUMN {col_name} {col_type}"))
            if col_name == "updated_at":
                conn.execute(
                    text(
                        f"UPDATE reports SET updated_at = created_at "
                        f"WHERE updated_at IS NULL"
                    )
                )
        conn.commit()
