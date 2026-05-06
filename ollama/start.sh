#!/bin/sh
ollama serve &
OLLAMA_PID=$!

echo "Waiting for Ollama to start..."
until ollama list > /dev/null 2>&1; do
  sleep 2
done

echo "Pulling phi3..."
ollama pull phi3

echo "Ollama ready, keeping alive..."
wait $OLLAMA_PID