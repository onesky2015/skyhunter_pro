import sys
import os

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from config import logger
from services.email import send_reset_code_email

print("Testing email send...")
success = send_reset_code_email("zhanglx01@gmail.com", "123456")
print(f"Email Sent Result: {success}")
