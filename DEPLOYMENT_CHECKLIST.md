# Production Deployment Checklist

Use this checklist to ensure your deployment is secure and production-ready.

## Pre-Deployment (Local Testing)

- [ ] Cloned repository and installed Docker
- [ ] Created `.env` file from `.env.example`
- [ ] Created `operations-api/.env` file from `operations-api/.env.example`
- [ ] Verified all services start with `docker compose up`
- [ ] Tested frontend access at http://localhost:5173
- [ ] Tested API access at http://localhost:5001
- [ ] Tested database connectivity with `docker compose exec postgres psql -U frostlink -d frostlink`
- [ ] Ran application smoke tests (login, dashboard, core features)
- [ ] Verified logs for any errors: `docker compose logs`

## UAT Deployment

- [ ] Determined UAT domain (e.g., `uat.frostlink.local` or `uat.app.com`)
- [ ] Created `.env.uat` from provided template
- [ ] Created `operations-api/.env.uat` from provided template
- [ ] Configured UAT domain settings in `.env.uat`:
  - [ ] Set `DATABASE_PASSWORD` to strong, unique value
  - [ ] Set `UAT_DOMAIN` to actual domain
  - [ ] Set `LETSENCRYPT_EMAIL` to valid email (for Let's Encrypt)
  - [ ] Generated `TRAEFIK_BASIC_AUTH` using htpasswd
- [ ] For local UAT testing: Added domain to hosts file
  ```
  # Windows: C:\Windows\System32\drivers\etc\hosts
  # Linux/macOS: /etc/hosts
  127.0.0.1 uat.frostlink.local
  ```
- [ ] Started UAT stack: `docker compose -f docker-compose.uat.yml up -d --build`
- [ ] Verified all services: `docker compose -f docker-compose.uat.yml ps`
- [ ] Tested HTTPS access (browser will warn about self-signed cert)
- [ ] Accessed Traefik dashboard and verified all services are healthy
- [ ] Performed full application testing in UAT:
  - [ ] User authentication (login/logout)
  - [ ] All major features accessible
  - [ ] No console errors in browser DevTools
  - [ ] API responses correct
  - [ ] Database queries working
- [ ] Verified SSL/TLS certificate installation
- [ ] Checked all environment variables are correctly set
- [ ] Monitored UAT logs for 24-48 hours (if applicable)

## Production Deployment

### Pre-Production Prep

- [ ] Created `.env.prod` from provided template
- [ ] Created `operations-api/.env.prod` from provided template
- [ ] Generated strong, unique secrets:
  - [ ] Database password: `openssl rand -base64 32`
  - [ ] JWT_SECRET: `openssl rand -base64 32`
  - [ ] MOBILE_API_KEY: `openssl rand -base64 32`
  - [ ] Traefik basic auth: `htpasswd -B -c auth admin`
- [ ] Updated `.env.prod` with ALL required values:
  - [ ] `DATABASE_USER` (default: `frostlink_prod`)
  - [ ] `DATABASE_PASSWORD` (strong, unique)
  - [ ] `DATABASE_NAME` (default: `frostlink_prod`)
  - [ ] `PROD_DOMAIN` (real domain, e.g., `app.frostlink.com`)
  - [ ] `LETSENCRYPT_EMAIL` (valid email for certificate renewal)
  - [ ] `TRAEFIK_BASIC_AUTH` (htpasswd hash)
- [ ] Updated `operations-api/.env.prod` with same secrets
- [ ] Verified `.env.prod` and `.env.prod.local` are in `.gitignore`
- [ ] Backed up all configuration files securely
- [ ] Used password manager to store all production secrets

### DNS & Network Configuration

- [ ] Registered production domain (e.g., `app.frostlink.com`)
- [ ] Configured DNS A record pointing to production server IP
- [ ] Waited for DNS propagation (up to 24 hours)
- [ ] Verified DNS resolution: `nslookup app.frostlink.com`
- [ ] Ensured ports 80 and 443 are open on firewall
- [ ] Configured any WAF (Web Application Firewall) rules if needed
- [ ] Set up DDoS protection if applicable

### Pre-Deployment Testing

- [ ] Backed up current database (if upgrading from existing system)
- [ ] Created test deployment on staging with production .env values
- [ ] Verified all services start cleanly
- [ ] Tested with production-like traffic/data volume
- [ ] Verified SSL/TLS certificates are valid and correctly configured
- [ ] Confirmed all logging and monitoring is active

### Deployment

- [ ] Set maintenance window and notified stakeholders
- [ ] Ensured backup of all data and configurations
- [ ] SSH'd into production server
- [ ] Cloned/pulled latest code: `git pull origin main`
- [ ] Updated production secrets in `.env.prod`
- [ ] Started production stack in background:
  ```bash
  docker compose -f docker-compose.prod.yml up -d --build
  ```
- [ ] Monitored startup: `docker compose -f docker-compose.prod.yml logs -f`
- [ ] Verified all services are running: `docker compose -f docker-compose.prod.yml ps`
- [ ] Checked service health: All should show "healthy" or "up" status

### Post-Deployment Verification

- [ ] Accessed frontend at production domain (https://app.frostlink.com)
- [ ] Verified SSL/TLS certificate is valid (no warnings in browser)
- [ ] Tested application functionality:
  - [ ] User login/authentication works
  - [ ] Core features functional
  - [ ] Dashboard loads and displays data
  - [ ] API endpoints responding correctly
  - [ ] No 500 errors in logs
- [ ] Verified database connectivity: `docker compose -f docker-compose.prod.yml exec postgres psql -U frostlink_prod -d frostlink_prod -c "\dt"`
- [ ] Checked Traefik dashboard (https://app.frostlink.com/dashboard)
- [ ] Reviewed all logs for errors:
  ```bash
  docker compose -f docker-compose.prod.yml logs --tail=100
  ```
- [ ] Monitored application for 1-2 hours for stability
- [ ] Tested admin functions (if applicable)
- [ ] Verified data is persistent after container restart

### Monitoring & Maintenance

- [ ] Set up monitoring alerts for CPU, memory, disk usage
- [ ] Configured log aggregation (optional but recommended)
- [ ] Set up automated backups:
  ```bash
  # Daily backup at 2 AM
  0 2 * * * docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U frostlink_prod frostlink_prod | gzip > /backups/frostlink-$(date +\%Y\%m\%d).sql.gz
  ```
- [ ] Scheduled backup retention policy (keep 30 days minimum)
- [ ] Set up Let's Encrypt certificate renewal monitoring
- [ ] Documented emergency rollback procedure
- [ ] Set up on-call escalation procedures

### Post-Deployment Security

- [ ] Disabled root SSH access (if applicable)
- [ ] Set up firewall rules to only allow needed ports
- [ ] Enabled audit logging for all administrative access
- [ ] Verified no default credentials remain
- [ ] Scanned for exposed secrets in logs/config
- [ ] Set up intrusion detection (IDS) if available
- [ ] Documented all access procedures for team

## Rollback Procedure (If Needed)

If deployment fails or major issues occur:

1. [ ] Stop current stack: `docker compose -f docker-compose.prod.yml down`
2. [ ] Restore previous code: `git checkout <previous-tag>`
3. [ ] Restore database if corrupted: `docker compose -f docker-compose.prod.yml exec -T postgres psql -U frostlink_prod frostlink_prod < /backups/latest.sql`
4. [ ] Start previous version: `docker compose -f docker-compose.prod.yml up -d --build`
5. [ ] Verify services are running
6. [ ] Test application functionality
7. [ ] Document what went wrong
8. [ ] Plan fix and retry deployment

## Ongoing Maintenance

- [ ] Schedule weekly log reviews
- [ ] Check database size growth monthly: `docker compose -f docker-compose.prod.yml exec postgres du -sh /var/lib/postgresql/data`
- [ ] Update PostgreSQL image quarterly (after testing in UAT)
- [ ] Review and update dependencies in `package.json` quarterly
- [ ] Rotate credentials semi-annually
- [ ] Test backup restoration monthly
- [ ] Review and update firewall rules as needed
- [ ] Monitor Let's Encrypt certificate renewal (Traefik handles automatically, but verify)
- [ ] Review access logs for suspicious activity weekly
- [ ] Document all infrastructure changes
- [ ] Schedule disaster recovery drills quarterly

## Contacts & Documentation

- [ ] Production server IP address recorded: `___________________`
- [ ] Production domain recorded: `___________________`
- [ ] Database backup location: `___________________`
- [ ] Let's Encrypt admin email: `___________________`
- [ ] On-call contact procedure documented
- [ ] Escalation procedures documented
- [ ] Incident response plan created
- [ ] Recovery Time Objective (RTO) defined: `___________________`
- [ ] Recovery Point Objective (RPO) defined: `___________________`

## Sign-Off

- [ ] Deployment lead: `_______________________` Date: `___________`
- [ ] Operations manager: `_______________________` Date: `___________`
- [ ] Project manager: `_______________________` Date: `___________`

---

**Last Updated:** `___________`  
**Deployment Version:** `___________`  
**Notes:**
```
[Add any notes or issues encountered during deployment]
```
