import sys
import os

# Add workers directory to path
sys.path.append(os.getcwd())

try:
    print("Attempting to import gemini...")
    from workers import gemini
    print("Successfully imported gemini")
except Exception as e:
    print(f"Failed to import gemini: {e}")
    sys.exit(1)
