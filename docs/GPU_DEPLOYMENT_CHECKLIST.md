# GPU Deployment Quick Reference

## Quick Start: GPU Migration

### Prerequisites
- [ ] GPU instance ready (CUDA-capable)
- [ ] Docker installed with GPU support
- [ ] Network access to PostgreSQL & Qdrant
- [ ] n8n admin access

---

## Deployment Steps

### 1. Deploy Ollama on GPU
```bash
# Install Docker GPU support
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker

# Run Ollama with GPU
docker run -d \
  --name ollama \
  --gpus all \
  -p 11434:11434 \
  -v ollama:/root/.ollama \
  --restart unless-stopped \
  ollama/ollama

# Verify GPU access
docker exec ollama nvidia-smi
```

### 2. Pull AI Models
```bash
# Chat model (tool-calling capable)
docker exec ollama ollama pull llama3.2:3b

# Embedding model
# Note: vector dimensionality must match your Qdrant collection config.
docker exec ollama ollama pull nomic-embed-text:latest

# Optional: Vision model
docker exec ollama ollama pull llava:latest

# Verify models
docker exec ollama ollama list
```

### 3. Update n8n Configuration
```bash
# Update Ollama base URL in n8n workflows
# Old: http://ollama.geuse.io
# New: http://<GPU_INSTANCE_IP>:11434

# Workflows to update:
# - AI Search Chat (cjsDoFFAvajWLhIo3Xy6Q)
# - AI Curator Assistant (2e0HoMh3hrIYZ2SZUQrMS)
# - Helper - Curator Operations (sGgv6lUC6udEkKKB)
# - AI Data Ingestion (webhook: /webhook/BsryWt8HYdCsVN46/webhook/data-ingestion)
```

If webhooks are returning 404 ("not registered") or n8n shows production URLs as `https://localhost:5678/...`,
fix n8n's public URL settings and restart n8n:

```bash
N8N_HOST=ai.geuse.io
N8N_PROTOCOL=https
N8N_PORT=5678
N8N_WEBHOOK_URL=https://ai.geuse.io/
N8N_EDITOR_BASE_URL=https://ai.geuse.io/
```

### 4. Test Performance
```bash
# Test embedding generation
curl http://<GPU_IP>:11434/api/embeddings \
  -d '{"model": "nomic-embed-text", "prompt": "test artwork description"}'

# Record the time (don’t guess)
curl -sS -w "\nTTFB=%{time_starttransfer}s total=%{time_total}s\n" -o /dev/null \
  http://<GPU_IP>:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model":"nomic-embed-text","prompt":"test artwork description"}'

# Test chat
curl http://<GPU_IP>:11434/api/generate \
  -d '{"model": "llama3.2:3b", "prompt": "Hello", "stream": false}'

# Record the time (don’t guess)
curl -sS -w "\nTTFB=%{time_starttransfer}s total=%{time_total}s\n" -o /dev/null \
  http://<GPU_IP>:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.2:3b","prompt":"Hello","stream":false}'
```

### 5. Run Data Ingestion
```bash
# Navigate to project
cd /Users/nucky/Repos/GEUSECurator

# Install requirements (once)
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt

# Test with 5 artworks
python scripts/data_ingestion_pipeline.py --limit 5 --batch-size 1 --cache-thumbnails-s3

# If you need to point at a different n8n instance:
# WEBHOOK_URL=https://ai.geuse.io/webhook/BsryWt8HYdCsVN46/webhook/data-ingestion python scripts/data_ingestion_pipeline.py --limit 5 --batch-size 1 --cache-thumbnails-s3

# Full ingestion (1000 artworks)
python scripts/data_ingestion_pipeline.py --limit 1000 --batch-size 20 --cache-thumbnails-s3

# Ingestion refresh command (recommended daily/refresh run)
python scripts/data_ingestion_pipeline.py --limit 1000 --batch-size 20 --cache-thumbnails-s3
```

### 6. Verify Frontend
```bash
# Test search
curl https://www.geuse.io/curator/

# Should load with artwork images (not placeholders)
```

---

## Expected Performance Gains

| Operation | CPU (Current) | GPU (Expected) | Improvement |
|-----------|---------------|----------------|-------------|
| Embedding | 5-10s | sub-second | varies |
| Chat inference | 2-5s | sub-second to a few seconds | varies |
| Ingestion/artwork | 30-40s | seconds-scale | varies |
| Search query | 10-30s | seconds-scale | varies |

Use the timing `curl -w` snippets above plus n8n execution durations to validate real gains.

---

## Troubleshooting

### GPU Not Detected
```bash
# Check NVIDIA driver
nvidia-smi

# Check Docker GPU support
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi

# Reinstall nvidia-docker2 if needed
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

### Models Not Loading
```bash
# Check Ollama logs
docker logs ollama

# Manually pull models
docker exec -it ollama bash
ollama pull llama3.2:3b

# Check disk space
df -h
```

### n8n Connection Issues
```bash
# Test Ollama from n8n server
curl http://<GPU_IP>:11434/api/tags

# Check firewall rules
sudo ufw status

# Allow Ollama port
sudo ufw allow 11434/tcp
```

---

## Monitoring

### GPU Utilization
```bash
# Watch GPU usage
watch -n 1 nvidia-smi

# Expected during inference:
# - GPU Utilization: 60-90%
# - Memory: 2-4 GB (llama3.2:3b)
```

### Ollama Metrics
```bash
# Check model performance
curl http://<GPU_IP>:11434/api/ps

# Response includes:
# - Model name
# - Memory usage
# - Processing time
```

### Application Metrics
```bash
# Monitor n8n executions
# Visit: https://ai.geuse.io → Executions

# Look for:
# - Reduced execution time
# - No timeout errors
# - 100% success rate
```

---

## Success Criteria

- [ ] Ollama running on GPU
- [ ] All models loaded (<5 min)
- [ ] n8n workflows updated
- [ ] Test ingestion succeeds (no timeouts / retries within chosen batch size)
- [ ] Search queries complete acceptably (validate with real timings)
- [ ] Frontend shows real artwork images
- [ ] No CloudFront timeouts
- [ ] GPU utilization 60-90% during load

---

## Rollback Plan

If issues occur:

1. **Update n8n back to old Ollama URL**
   - `http://ollama.geuse.io`

2. **Verify old instance still running**
   ```bash
   curl http://ollama.geuse.io/api/tags
   ```

3. **Test workflows**
   - Should work (with timeouts as before)

4. **Debug GPU issues separately**
   - Don't block production

---

## Post-Deployment

### Update Documentation
- [ ] Update CLAUDE.md with new Ollama URL
- [ ] Update README.md with performance metrics
- [ ] Add GPU setup to deployment.md

### Monitor for 24 Hours
- [ ] Check error rates
- [ ] Monitor response times
- [ ] Track GPU temperature/utilization
- [ ] Verify data quality

### Optimize
- [ ] Fine-tune batch sizes
- [ ] Adjust model parameters
- [ ] Implement caching if needed
- [ ] Scale up ingestion volume

---

## 🚀 Ready to Deploy?

Run this final check:

```bash
# 1. GPU ready?
nvidia-smi

# 2. Models downloaded?
docker exec ollama ollama list

# 3. n8n workflows updated?
curl https://ai.geuse.io/api/v1/workflows

# 4. Frontend ready?
curl https://www.geuse.io/curator/

# ALL ✅? Let's go! 🎨
```

---

**Good luck with your GPU deployment!** 🚀

*For questions, refer to troubleshooting.md or PROJECT_SUMMARY.md*
