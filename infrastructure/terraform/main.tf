terraform {
  required_version = ">= 1.8.0"
}
variable "environment" { type = string }
locals { common_tags = { system = "wedding-system", environment = var.environment } }
# Provider-specific modules intentionally require explicit ADR and human approval.
