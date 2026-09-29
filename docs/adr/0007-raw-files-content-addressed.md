# Raw files are stored by content hash

We store each downloaded file under the SHA-256 hash of its content and don't modify it afterwards. HIQA replaces some files at the same URL (the registers are overwritten in place), so naming files by URL or file name would lose earlier versions. With the hash as the name, each version is kept once, and anything we extract later can point to the exact file it came from.

For now the files are on the VM and copied to the `clearcare-raw` bucket. The manifest records where and when each file was downloaded. Setup and paths are in [infra/systemd/README.md](../../infra/systemd/README.md).
