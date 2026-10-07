# The database and the API run as containers on the VM

PostgreSQL and the API run under Docker Compose on the pipeline's VM, next to the pipeline's own containers. Only the API can be reached from the internet, through the VM's existing reverse proxy on port 443. The database publishes no port: the API and the pipeline reach it over the Compose network. The public site on Vercel calls the API from its server code.

The cost is one VM with no redundancy: when it is down, the site has no data. Images are built on the VM. There are no backups until the database holds something that cannot be rebuilt from the raw files in object storage (ADR-0007), such as reviewers' decisions.

ADR-0008 already turned down a managed database. We also looked at a hosted platform for the API, which would need the database open to the internet, and at Kubernetes, which needs someone to own its operation. Nobody on the team does.
