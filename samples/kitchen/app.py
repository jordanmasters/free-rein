"""App."""
client = Client(model="text-embedding-3-small")
run("ollama run llama3.2:1b")
d = decide(model="jev-latest")
