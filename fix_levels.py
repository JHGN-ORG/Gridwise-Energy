from PIL import Image

img = Image.open('public/logo.png').convert('RGB')
data = img.getdata()

bg_r, bg_g, bg_b = 3, 29, 42

new_data = []
for r, g, b in data:
    new_r = max(0, r - bg_r) * 255 // (255 - bg_r)
    new_g = max(0, g - bg_g) * 255 // (255 - bg_g)
    new_b = max(0, b - bg_b) * 255 // (255 - bg_b)
    
    # clamp to 255 just in case
    new_r = min(255, new_r)
    new_g = min(255, new_g)
    new_b = min(255, new_b)
    
    new_data.append((new_r, new_g, new_b))

img.putdata(new_data)
img.save('public/logo.png', 'PNG')
print("Levels adjusted to make background pure black!")
