#!/usr/bin/env python3
"""
Simple log collector for Windows Docker Desktop
Collects logs from Docker containers and sends them to Elasticsearch
"""

import docker
import requests
import json
import time
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
ELASTICSEARCH_URL = "http://elasticsearch:9200"
INDEX_PREFIX = "logistics-logs"
SERVICES_TO_MONITOR = ["auth-service", "orders-service", "company-service", "tms-service", "postgres_ERP", "redis", "kafka", "elasticsearch"]

def send_to_elasticsearch(log_entry):
    """Send log entry to Elasticsearch"""
    try:
        timestamp = datetime.utcnow().isoformat()
        index_name = f"{INDEX_PREFIX}-{datetime.utcnow().strftime('%Y.%m.%d')}"

        doc = {
            "@timestamp": timestamp,
            "message": log_entry.get("message", ""),
            "container": log_entry.get("container_name", ""),
            "service": log_entry.get("service_name", ""),
            "level": log_entry.get("level", "INFO"),
            "source": "docker"
        }

        url = f"{ELASTICSEARCH_URL}/{index_name}/_doc"
        response = requests.post(url, json=doc)

        if response.status_code in [200, 201]:
            return True
        else:
            logger.error(f"Failed to send to Elasticsearch: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        logger.error(f"Error sending to Elasticsearch: {e}")
        return False

def get_container_service_name(container_name):
    """Extract service name from container name"""
    for service in SERVICES_TO_MONITOR:
        if service in container_name:
            return service
    return container_name

def parse_log_line(line):
    """Parse a log line to extract structured data"""
    try:
        # Try to parse as JSON
        log_data = json.loads(line)
        return log_data
    except:
        # If not JSON, create a simple structure
        return {"message": line.strip()}

def collect_logs():
    """Main log collection loop"""
    logger.info("Starting log collector...")

    # Connect to Docker
    try:
        client = docker.from_env()
        logger.info("Connected to Docker")
    except Exception as e:
        logger.error(f"Failed to connect to Docker: {e}")
        return

    # Get containers to monitor
    containers = []
    for container_name in SERVICES_TO_MONITOR:
        try:
            container = client.containers.get(container_name)
            containers.append(container)
            logger.info(f"Found container: {container_name}")
        except docker.errors.NotFound:
            logger.warning(f"Container not found: {container_name}")
        except Exception as e:
            logger.error(f"Error getting container {container_name}: {e}")

    if not containers:
        logger.error("No containers found to monitor!")
        return

    # Collect logs
    while True:
        for container in containers:
            try:
                # Get recent logs (last 5 seconds)
                logs = container.logs(since=int(time.time() - 5), timestamps=False).decode('utf-8')

                for line in logs.split('\n'):
                    if line.strip():
                        log_data = parse_log_line(line)
                        log_data['container_name'] = container.name
                        log_data['service_name'] = get_container_service_name(container.name)

                        send_to_elasticsearch(log_data)

            except Exception as e:
                logger.error(f"Error collecting logs from {container.name}: {e}")

        # Sleep for 5 seconds before next collection
        time.sleep(5)

if __name__ == "__main__":
    # Wait for Elasticsearch to be available
    import time
    while True:
        try:
            response = requests.get(f"{ELASTICSEARCH_URL}/_cluster/health")
            if response.status_code == 200:
                logger.info("Elasticsearch is ready!")
                break
        except:
            logger.info("Waiting for Elasticsearch...")
            time.sleep(5)

    # Start collecting logs
    collect_logs()