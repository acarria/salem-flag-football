#!/usr/bin/env python3
"""
Script to add admin user to the database
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.db.db import get_db
from app.models.admin_config import AdminConfig

def add_admin_user():
    """Add the admin user to the database"""
    db = next(get_db())
    
    # Check if admin already exists
    existing_admin = db.query(AdminConfig).filter(
        AdminConfig.email == "alexcarria1@gmail.com"
    ).first()
    
    if existing_admin:
        print("Admin user already exists!")
        if existing_admin.is_active:
            print("Admin user is active.")
        else:
            print("Admin user is inactive. Activating...")
            existing_admin.is_active = True
            db.commit()
            print("Admin user activated!")
        return
    
    # Create new admin user
    admin_config = AdminConfig(
        email="alexcarria1@gmail.com",
        role="super_admin",
        is_active=True
    )
    
    try:
        db.add(admin_config)
        db.commit()
        print("Admin user created successfully!")
    except Exception as e:
        db.rollback()
        print(f"Error creating admin user: {e}")

if __name__ == "__main__":
    add_admin_user() 