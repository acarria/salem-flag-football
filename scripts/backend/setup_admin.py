#!/usr/bin/env python3
"""
Setup script to add the first admin email address to the database.
Run this script once to configure admin access.
"""

import os
import sys
from sqlalchemy.orm import Session
from app.db.db import SessionLocal
from app.services.admin_service import AdminService

def setup_admin():
    """Setup the first admin user"""
    db = SessionLocal()
    
    try:
        # Get admin email from environment or user input
        admin_email = os.getenv('ADMIN_EMAIL')
        
        if not admin_email:
            print("No ADMIN_EMAIL environment variable found.")
            admin_email = input("Enter your email address to set as admin: ").strip()
            
            if not admin_email:
                print("No email provided. Exiting.")
                return
        
        # Check if admin already exists
        if AdminService.is_admin_email(db, admin_email):
            print(f"Admin email {admin_email} already exists in the database.")
            return
        
        # Add admin email
        admin_config = AdminService.add_admin_email(db, admin_email, "super_admin")
        print(f"✅ Successfully added {admin_email} as super admin!")
        print(f"Admin ID: {admin_config.id}")
        print(f"Role: {admin_config.role}")
        print(f"Created: {admin_config.created_at}")
        
        # List all admins
        admins = AdminService.get_all_admins(db)
        print(f"\n📋 Current admins ({len(admins)}):")
        for admin in admins:
            print(f"  - {admin.email} ({admin.role})")
            
    except Exception as e:
        print(f"❌ Error setting up admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    setup_admin() 