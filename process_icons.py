
import os
from PIL import Image
import shutil

# Source image path (this will be the artifact path I just generated, I need to know where it is, 
# but the tool outputs it to a weird path. I should probably tell the user to manually copy it? 
# No, I can't read the artifact path programmatically easily if not passed. 
# Wait, I can't see the artifact path in the "CodeContent". 
# Actually, I can just write a script that takes an input path.
# However, I don't have the artifact in the workspace yet.
# I will assume I can't access that specific path easily from python unless I move it.
# BUT, the `generate_image` tool SAVED it to an artifact.
# I will ask the user to help me move it or I will try to use the `download` or just use a placeholder for now?
# NO, I need to solve this.

# Revised plan:
# I cannot rely on the python script to find the artifact path unless I key it in.
# The artifact path was: C:/Users/Administrator/.gemini/antigravity/brain/a95a8bed-cbac-44a9-a43c-18bee19e65ae/web_scraper_icon_1769348198477.png
# I will "hardcode" this path in the python script for this one-shot fix.

from PIL import Image

source_path = r"C:/Users/Administrator/.gemini/antigravity/brain/a95a8bed-cbac-44a9-a43c-18bee19e65ae/web_scraper_spider_icon_1769348297278.png"
dest_dir = r"D:\AI_project\web-scraper\src\icons"
dist_dir = r"D:\AI_project\web-scraper\dist\icons"

if not os.path.exists(dest_dir):
    os.makedirs(dest_dir)

if not os.path.exists(dist_dir):
    os.makedirs(dist_dir)

try:
    img = Image.open(source_path)
    
    sizes = [16, 48, 128]
    for size in sizes:
        resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
        
        # Save to src
        src_save_path = os.path.join(dest_dir, f"icon{size}.png")
        resized_img.save(src_save_path)
        print(f"Saved {src_save_path}")
        
        # Save to dist
        dist_save_path = os.path.join(dist_dir, f"icon{size}.png")
        resized_img.save(dist_save_path)
        print(f"Saved {dist_save_path}")
        
except Exception as e:
    print(f"Error processing image: {e}")
