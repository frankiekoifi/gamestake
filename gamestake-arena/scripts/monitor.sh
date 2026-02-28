#!/bin/bash
# scripts/monitor.sh

echo "📊 GameStake Arena Monitoring"
echo "=============================="
echo ""

# Check system resources
echo "💻 System Resources:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "🔍 Service Health:"
for service in postgres redis backend frontend-web; do
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' gamestake-$service 2>/dev/null || echo "N/A")
    STATUS=$(docker inspect --format='{{.State.Status}}' gamestake-$service 2>/dev/null || echo "N/A")
    echo "  $service: Status=$STATUS, Health=$HEALTH"
done

echo ""
echo "📈 Database Statistics:"
docker-compose exec -T postgres psql -U postgres -d gamestake -c "
    SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM matches) as matches,
        (SELECT COUNT(*) FROM transactions) as transactions,
        (SELECT COUNT(*) FROM disputes) as disputes,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'completed' AND type = 'deposit') as total_deposits,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'completed' AND type = 'withdrawal') as total_withdrawals,
        (SELECT COALESCE(SUM(fee), 0) FROM transactions WHERE status = 'completed') as total_fees;
"

echo ""
echo "📝 Recent Errors:"
docker-compose logs --tail=50 backend | grep -i error || echo "No recent errors"