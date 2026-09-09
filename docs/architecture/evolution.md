# Architecture Evolution

MVP colocates business modules in backend API and uses workers for isolation of asynchronous tasks. At growth, add read replicas, partition audit/outbox/events, autoscale public delivery and workers, and extract media/notification/payment only when operational signals justify it. At enterprise scale, introduce tenant placement, optional dedicated databases, regional workloads, warehouse/event streaming, and stronger SLOs.
