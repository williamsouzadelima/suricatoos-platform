# Alerting (vmalert)

The observability stack scrapes node-exporter / cadvisor / postgres-exporter into
**VictoriaMetrics**, but ships **no alerting** — so the disk-full → Postgres-PANIC
outage fires silently. `rules/suricatoos.yml` adds disk / Postgres / container
alerts. To activate them, run **vmalert** against VictoriaMetrics and route alerts
to a notifier.

Add to `docker-compose-observability.yml` (adjust hostnames to your stack):

```yaml
  vmalert:
    image: victoriametrics/vmalert:v1.108.1
    container_name: vmalert
    restart: unless-stopped
    command:
      - "-rule=/etc/alerts/*.yml"
      - "-datasource.url=http://victoriametrics:8428"
      - "-remoteWrite.url=http://victoriametrics:8428"
      - "-notifier.url=http://alertmanager:9093"   # or a webhook receiver
    volumes:
      - ./observability/vmalert/rules:/etc/alerts:ro
    networks:
      - observability-network
```

Then add an **Alertmanager** (or any `-notifier.url` webhook) and route
`severity: critical` / `severity: warning` to Slack / email / PagerDuty.

Alternative (no new services): import `rules/suricatoos.yml` expressions as
**Grafana unified-alerting** rules against the VictoriaMetrics datasource and
attach a contact point — Grafana 11 is already deployed.

> Metric/label/job names assume the default exporters. If your scrape config
> renames jobs or mountpoints, tweak `job=` / `mountpoint=` in the rules.
