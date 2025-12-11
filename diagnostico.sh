#!/bin/bash

# Script para diagnosticar problemas en Elastic Beanstalk

echo "🔍 DIAGNÓSTICO DE ELASTIC BEANSTALK"
echo "===================================="
echo ""

# Obtener información del environment
ENV_NAME="registro-horas-backend-env"
APP_NAME="registro-horas-backend"
REGION="eu-west-3"

echo "📋 1. Estado del Environment"
aws elasticbeanstalk describe-environments \
  --environment-names "$ENV_NAME" \
  --region "$REGION" \
  --query 'Environments[0].[EnvironmentName,Status,Health,HealthStatus]' \
  --output table

echo ""
echo "🌐 2. URL del Environment"
aws elasticbeanstalk describe-environments \
  --environment-names "$ENV_NAME" \
  --region "$REGION" \
  --query 'Environments[0].CNAME' \
  --output text

echo ""
echo "📊 3. Últimos eventos (últimos 20)"
aws elasticbeanstalk describe-events \
  --environment-name "$ENV_NAME" \
  --region "$REGION" \
  --max-records 20 \
  --query 'Events[*].[EventDate,Severity,Message]' \
  --output table

echo ""
echo "📝 4. Health del Environment"
aws elasticbeanstalk describe-environment-health \
  --environment-name "$ENV_NAME" \
  --region "$REGION" \
  --attribute-names All \
  --query '[Status,Color,Causes]' \
  --output json

echo ""
echo "💾 5. Descargar logs completos"
echo "   Ejecuta este comando para ver todos los logs:"
echo "   eb logs -a $APP_NAME -e $ENV_NAME --region $REGION"
echo ""
echo "   O descárgalos con:"
echo "   aws elasticbeanstalk request-environment-info \\"
echo "     --environment-name $ENV_NAME \\"
echo "     --info-type tail \\"
echo "     --region $REGION"

echo ""
echo "🔧 6. Recursos del Environment"
aws elasticbeanstalk describe-environment-resources \
  --environment-name "$ENV_NAME" \
  --region "$REGION" \
  --query 'EnvironmentResources.[Instances[0].Id,LoadBalancers[0].Name]' \
  --output table

echo ""
echo "================================================================"
echo "📌 ACCIONES RÁPIDAS:"
echo "================================================================"
echo ""
echo "Ver logs en tiempo real:"
echo "  aws logs tail /aws/elasticbeanstalk/$ENV_NAME/var/log/eb-engine.log --follow --region $REGION"
echo ""
echo "Reiniciar el environment:"
echo "  aws elasticbeanstalk restart-app-server --environment-name $ENV_NAME --region $REGION"
echo ""
echo "Rebuild completo:"
echo "  aws elasticbeanstalk rebuild-environment --environment-name $ENV_NAME --region $REGION"
echo ""echo "✅ Diagnóstico completado."