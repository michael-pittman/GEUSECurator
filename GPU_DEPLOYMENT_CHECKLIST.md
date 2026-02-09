# GPU Deployment Quick Reference

## 🚀 Quick Start: GPU Migration

### Prerequisites
- [ ] GPU instance ready (CUDA-capable)
- [ ] Docker installed with GPU support
- [ ] Network access to PostgreSQL & Qdrant
- [ ] n8n admin access

---

## 📋 Deployment Steps

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

# Embedding model (768-d vectors)
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
# - AI Data Ingestion (if exists)
```

### 4. Test Performance
```bash
# Test embedding generation
curl http://<GPU_IP>:11434/api/embeddings \
  -d '{"model": "nomic-embed-text", "prompt": "test artwork description"}'

# Expected: <100ms response time

# Test chat
curl http://<GPU_IP>:11434/api/generate \
  -d '{"model": "llama3.2:3b", "prompt": "Hello", "stream": false}'

# Expected: <500ms response time
```

### 5. Run Data Ingestion
```bash
# Navigate to project
cd /Users/nucky/Repos/NGA

# Activate venv
source .venv/bin/activate

# Test with 5 artworks
python scripts/data_ingestion_pipeline.py --limit 5 --batch-size 1

# Expected: Success (no timeouts)

# Full ingestion (1000 artworks)
python scripts/data_ingestion_pipeline.py --limit 1000 --batch-size 20
```

### 6. Verify Frontend
```bash
# Test search
curl https://www.geuse.io/curator/

# Should load with artwork images (not placeholders)
```

---

## ⚡ Expected Performance Gains

| Operation | CPU (Current) | GPU (Expected) | Improvement |
|-----------|---------------|----------------|-------------|
| Embedding | 5-10s | <100ms | **50-100x** |
| Chat inference | 2-5s | <500ms | **4-10x** |
| Ingestion/artwork | 30-40s | 1-2s | **15-20x** |
| Search query | 10-30s | <1s | **10-30x** |

---

## 🔍 Troubleshooting

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

## 📊 Monitoring

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

## 🎯 Success Criteria

- [ ] Ollama running on GPU
- [ ] All models loaded (<5 min)
- [ ] n8n workflows updated
- [ ] Test ingestion succeeds (<2s per artwork)
- [ ] Search queries complete (<1s)
- [ ] Frontend shows real artwork images
- [ ] No CloudFront timeouts
- [ ] GPU utilization 60-90% during load

---

## 🔄 Rollback Plan

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

## 📝 Post-Deployment

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

*For questions, refer to docs/troubleshooting.md or PROJECT_SUMMARY.md*
