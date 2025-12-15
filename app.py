import json
import os
import sys

import requests


def stream_completion(api_url: str, model: str, prompt: str) -> None:
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": True,
    }

    try:
        with requests.post(api_url, json=payload, stream=True, timeout=300) as response:
            response.raise_for_status()
            print("Streaming response:\n", flush=True)
            for line in response.iter_lines():
                if not line:
                    continue
                try:
                    chunk = json.loads(line)
                except json.JSONDecodeError:
                    continue
                token = chunk.get("response", "")
                if token:
                    print(token, end="", flush=True)
                if chunk.get("done"):
                    print("\n---\nCompleted response from model.")
                    return
    except requests.RequestException as exc:
        print(f"Error contacting Ollama API at {api_url}: {exc}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    api_url = os.environ.get("LLM_API_URL", "http://host.docker.internal:11434/api/generate")
    model = os.environ.get("LLM_MODEL", "qwen2.5:14b")
    prompt = (
        "Explain why connecting Docker to localhost logic requires host.docker.internal on macOS."
    )

    print(f"Using Ollama API: {api_url}")
    print(f"Target model: {model}\n")
    stream_completion(api_url, model, prompt)


if __name__ == "__main__":
    main()
