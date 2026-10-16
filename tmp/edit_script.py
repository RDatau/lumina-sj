
with open("components/ChatView.tsx", "r") as f:
    content = f.read()

target = '<div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden" key={item.data}>'
replacement = """<div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden" key={item.data}
                          onMouseEnter={() => {
                            setShowControls(true);
                            if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
                          }}
                          onMouseLeave={() => {
                            if (previewVideoPlaying) {
                              hideControlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2000);
                            }
                          }}
                        >"""

# Using a more robust replacement by just using the start of the line
for line in content.splitlines():
    if 'flex flex-col items-center justify-center' in line and 'key={item.data}>' in line:
        content = content.replace(line, replacement)
        break

with open("components/ChatView.tsx", "w") as f:
    f.write(content)
