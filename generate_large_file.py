import os

file_path = "large_test_file.txt"
target_size = 50 * 1024 * 1024 # 50 MB

with open(file_path, "w") as f:
    f.write("Start of Large File\n")
    i = 0
    while os.path.getsize(file_path) < target_size:
        f.write(f"Line {i}: This is some filler text to simulate a large file content. Repeat repeat repeat.\n")
        i += 1
    f.write("End of Large File\n")

print(f"Created {file_path} with size {os.path.getsize(file_path)} bytes")
