#!/bin/bash
set -e

echo "========================================================"
echo "🚀 [BrilianAI] Mengunduh & Memverifikasi Model AI di VPS"
echo "========================================================"

# Pastikan container Ollama sedang berjalan
if ! docker ps | grep -q brilian_ollama; then
    echo "❌ Container brilian_ollama belum berjalan. Jalankan 'docker compose up -d' terlebih dahulu."
    exit 1
fi

echo "1/4 👁️ Mengunduh AI Vision (qwen2.5vl:3b)..."
docker exec -it brilian_ollama ollama pull qwen2.5vl:3b

echo "2/4 🧠 Mengunduh AI Embedding (bge-m3)..."
docker exec -it brilian_ollama ollama pull bge-m3

echo "3/4 ✨ Mengunduh AI Kurasi Data (llama3.2:3b)..."
docker exec -it brilian_ollama ollama pull llama3.2:3b

echo "4/4 💬 Mengunduh AI Chatbot Cepat (gemma2:2b)..."
docker exec -it brilian_ollama ollama pull gemma2:2b

echo ""
echo "========================================================"
echo "✅ SELURUH MODEL BERHASIL DIUNDUH! DAFTAR MODEL AKTIF:"
echo "========================================================"
docker exec -it brilian_ollama ollama list
