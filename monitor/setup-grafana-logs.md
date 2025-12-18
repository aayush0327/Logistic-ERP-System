# Grafana Log Dashboard Setup

## Quick Setup Steps:

### 1. Import the Log Dashboard

1. Open Grafana: http://localhost:3001 (admin/admin)
2. Go to **Dashboards** → **New Dashboard** → **Import Dashboard**
3. Copy the JSON content from `monitoring/grafana/dashboards/log-dashboard.json`
4. Paste it into the import dialog
5. Click **Import**

### 2. Add Elasticsearch Data Source (if not already added)

1. Go to **Configuration** → **Data Sources**
2. Click **Add data source**
3. Select **Elasticsearch**
4. Configure:
   - **Name**: Elasticsearch-Logs
   - **URL**: http://elasticsearch:9200
   - **Database**: `logistics-logs-*`
   - **Time field**: `@timestamp`
5. Click **Save & Test**

### 3. Alternative: Create Log Dashboard Manually

1. Go to **Dashboards** → **New Dashboard**
2. Add a new panel
3. Select **Logs** visualization
4. Select **Elasticsearch-Logs** as data source
5. In the query field, enter:
   - For all logs: `*`
   - For errors only: `level:ERROR OR message:*Error*`
   - For specific service: `service:auth-service`

## Viewing Logs

Once set up, you can:
- View real-time logs from all services
- Filter by service name
- Search for specific text in logs
- Filter by log level (ERROR, INFO, DEBUG)
- Click on any log entry to see full details

## Tips

- Use the time range selector to view logs from specific time periods
- The logs auto-refresh every 5 seconds
- Use the Explore tab for ad-hoc log queries
- Combine metrics and logs in the same dashboard for correlation