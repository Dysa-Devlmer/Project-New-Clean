# Zero Trust Security Policy for Enterprise Fortune 10 Global Military
# Open Policy Agent (OPA) Rego policies for zero trust architecture

package zerotrust

import rego.v1

# Default deny - Zero trust principle: Never trust, always verify
default allow := false

# Allow only authenticated and authorized requests
allow if {
    input.auth.authenticated == true
    input.auth.method in ["mTLS", "JWT", "OIDC"]
    valid_authorization
}

# Validate authorization based on RBAC and ABAC
valid_authorization if {
    user_has_required_role
    request_matches_policy
    device_compliance_verified
    network_zone_authorized
}

# Role-Based Access Control (RBAC)
user_has_required_role if {
    required_roles := data.policies.rbac[input.resource][input.action]
    user_roles := input.auth.user.roles
    intersection := required_roles & user_roles
    count(intersection) > 0
}

# Request policy validation
request_matches_policy if {
    policy := data.policies.requests[input.resource]
    input.request.method in policy.allowed_methods
    valid_request_headers
    valid_request_body
}

# Device compliance validation
device_compliance_verified if {
    input.device.compliance_status == "compliant"
    input.device.last_check_time > time.now_ns() - (24 * 60 * 60 * 1000000000) # 24 hours
    input.device.security_patch_level >= data.minimum_patch_level
}

# Network zone authorization
network_zone_authorized if {
    allowed_zones := data.policies.network_zones[input.auth.user.clearance_level]
    input.network.zone in allowed_zones
    input.network.encrypted == true
}

# Request header validation
valid_request_headers if {
    required_headers := data.policies.security_headers
    provided_headers := {key | input.request.headers[key]}
    missing_headers := required_headers - provided_headers
    count(missing_headers) == 0
}

# Request body validation for sensitive operations
valid_request_body if {
    input.action != "write"
} else if {
    input.request.body.encrypted == true
    valid_data_classification
}

# Data classification validation
valid_data_classification if {
    user_clearance := input.auth.user.clearance_level
    data_classification := input.request.body.classification

    # Security clearance hierarchy: PUBLIC < INTERNAL < CONFIDENTIAL < SECRET < TOP_SECRET
    clearance_levels := {
        "PUBLIC": 1,
        "INTERNAL": 2,
        "CONFIDENTIAL": 3,
        "SECRET": 4,
        "TOP_SECRET": 5
    }

    clearance_levels[user_clearance] >= clearance_levels[data_classification]
}

# Audit logging requirement
audit_required if {
    input.action in ["create", "update", "delete"]
    input.resource in data.critical_resources
}

# Rate limiting validation
rate_limit_ok if {
    user_tier := input.auth.user.tier
    current_requests := input.rate_limit.current_requests
    max_requests := data.rate_limits[user_tier]
    current_requests < max_requests
}