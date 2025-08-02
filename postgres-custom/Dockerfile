# Use the official TimescaleDB image as the base
# This gives us PostgreSQL 16 and TimescaleDB out of the box
FROM timescale/timescaledb:latest-pg16

# Switch to root user to install packages
USER root

# FIX: Add 'llvm' to provide the full toolchain, including the 'llvm-lto' linker.
RUN apk add --no-cache \
    build-base \
    git \
    postgresql-dev \
    clang \
    llvm

# Clone, compile, and install a compatible version of the pgvector extension
RUN git clone --branch v0.7.2 https://github.com/pgvector/pgvector.git /tmp/pgvector \
    && cd /tmp/pgvector \
    && make \
    && make install

# Clean up the build directory to keep the image small
RUN rm -rf /tmp/pgvector

# Switch back to the default postgres user for security
USER postgres