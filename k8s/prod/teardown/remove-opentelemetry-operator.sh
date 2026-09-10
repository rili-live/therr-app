#!/usr/bin/env bash
#
# Remove the OpenTelemetry Operator from the production cluster.
#
# WHY
# ---
# The operator was installed 2023-09-01 and has been dead weight ever since:
#
#   * It manages ZERO custom resources -- there are no OpenTelemetryCollector
#     and no Instrumentation objects in any namespace.
#   * The only in-repo collector manifest (k8s/prod/open-telemetry-collector.yaml)
#     was commented out in its entirety, and has been deleted alongside this script.
#   * Its deployment has been Available=False, stuck in ImagePullBackOff, because
#     gcr.io/kubebuilder/kube-rbac-proxy:v0.13.1 no longer exists (Google retired
#     that registry path). It will never resolve again.
#   * Application traces do NOT flow through it. Every service exports OTLP
#     straight to Honeycomb via HONEYCOMB_API_KEY, so removing the operator does
#     not affect observability.
#
# Meanwhile it reserved 105m CPU and 128Mi on main-pool -- a single e2-small with
# only 940m CPU allocatable, of which kube-system DaemonSets already claim 648m.
# That contention was starving co-located pods into probe-timeout restart loops.
#
# SAFETY
# ------
# The validating webhook is scoped exclusively to apiGroups ["opentelemetry.io"]
# (instrumentations, opentelemetrycollectors). Its failurePolicy=Fail therefore
# cannot block any application workload -- only otel CRs, which do not exist.
#
# Deleting the CRDs would cascade-delete any CR of those types. The guard below
# refuses to proceed if any are found, so an unexpected CR aborts the teardown
# rather than being silently destroyed.
#
# Usage:  ./k8s/prod/teardown/remove-opentelemetry-operator.sh [--dry-run]

set -euo pipefail

NS="opentelemetry-operator-system"
DRY_RUN=""
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN="--dry-run=client"

echo "==> Verifying no OpenTelemetry custom resources exist"
existing=$(kubectl get opentelemetrycollectors,instrumentations -A \
    --ignore-not-found -o name 2>/dev/null | wc -l | tr -d ' ')
if [[ "$existing" != "0" ]]; then
    echo "ABORT: found $existing OpenTelemetry custom resource(s)." >&2
    echo "Deleting the CRDs would cascade-delete them. Review before proceeding:" >&2
    kubectl get opentelemetrycollectors,instrumentations -A >&2
    exit 1
fi
echo "    none found - safe to proceed"

echo "==> Deleting validating webhook configuration"
kubectl delete validatingwebhookconfiguration \
    opentelemetry-operator-validating-webhook-configuration \
    --ignore-not-found $DRY_RUN

echo "==> Deleting CRDs"
kubectl delete crd \
    opentelemetrycollectors.opentelemetry.io \
    instrumentations.opentelemetry.io \
    --ignore-not-found $DRY_RUN

echo "==> Deleting cluster-scoped RBAC"
kubectl delete clusterrolebinding \
    opentelemetry-operator-manager-rolebinding \
    opentelemetry-operator-proxy-rolebinding \
    --ignore-not-found $DRY_RUN
kubectl delete clusterrole \
    opentelemetry-operator-manager-role \
    opentelemetry-operator-metrics-reader \
    opentelemetry-operator-proxy-role \
    --ignore-not-found $DRY_RUN

echo "==> Deleting namespace $NS (deployment, services, SA, namespaced RBAC)"
kubectl delete namespace "$NS" --ignore-not-found $DRY_RUN

echo
echo "Done. Expected reclaim on main-pool: 105m CPU, 128Mi memory."
echo "Verify with:"
echo "  kubectl describe node \$(kubectl get nodes -l cloud.google.com/gke-nodepool=main-pool -o name | head -1 | cut -d/ -f2) | sed -n '/Allocated resources/,/Events/p'"
