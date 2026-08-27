# NavoFeatureEngine V8.20 — CPU reference image.
# Pin upstream code so recognition behavior is reproducible.
FROM mambaorg/micromamba:1.5.10
ARG AAGNET_COMMIT=e0e36b7a12a7f01a29d7be36efc22730d293a1bd
USER root
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates build-essential && rm -rf /var/lib/apt/lists/*
RUN micromamba install -y -n base -c conda-forge python=3.10 pythonocc-core=7.5.1 occt=7.5.1 numpy scipy numba h5py scikit-learn tqdm pip && micromamba clean --all --yes
RUN /opt/conda/bin/pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchvision && \
    /opt/conda/bin/pip install --no-cache-dir dgl==1.1.0 timm torchmetrics torch-ema fastapi uvicorn[standard] && \
    /opt/conda/bin/pip install --no-cache-dir git+https://github.com/AutodeskAILab/occwl.git
RUN git clone https://github.com/whjdark/AAGNet.git /opt/AAGNet && cd /opt/AAGNet && git checkout ${AAGNET_COMMIT}
WORKDIR /app
COPY app.py /app/app.py
ENV AAGNET_ROOT=/opt/AAGNet AAGNET_COMMIT=${AAGNET_COMMIT} AAGNET_DEVICE=cpu PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["/opt/conda/bin/python","-m","uvicorn","app:app","--host","0.0.0.0","--port","8080","--workers","1"]
