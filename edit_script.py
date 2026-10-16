
with open("components/ChatView.tsx", "r") as f:
    content = f.read()

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

new_content = ""
for line in content.splitlines():
    if 'flex flex-col items-center justify-center' in line and 'key={item.data}>' in line:
        new_content += line[:line.find('<div')] + replacement + "\n"
    else:
        new_content += line + "\n"

with open("components/ChatView.tsx", "w") as f:
    f.write(new_content)
