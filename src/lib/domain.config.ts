export const domainConfig = {
  appId: 'pisastyle',
  appName: 'PISAStyle by SWAL',
  instanceId: 'default',
  entities: [
    {
        name: "pisa_unit",
        label: "Unidad PISA",
        fields: [
            "unit_id",
            "domain",
            "process",
            "content",
            "context",
            "proficiency_level",
            "stimulus_ref",
            "locale",
            "protocol_version",
            "status"
        ],
        xavierKind: "pisa_unit"
    },
    {
        name: "study_content",
        label: "Contenido de estudio",
        fields: [
            "unit_id",
            "locale",
            "body_ref",
            "study_minutes",
            "sources",
            "protocol_version",
            "status"
        ],
        xavierKind: "study_content"
    },
    {
        name: "exam_attempt",
        label: "Intento de examen",
        fields: [
            "attempt_hash",
            "unit_id",
            "score",
            "instance_ref",
            "locale",
            "status"
        ],
        xavierKind: "exam_attempt"
    },
    {
        name: "infographic",
        label: "Infografia",
        fields: [
            "slug",
            "kind",
            "locale",
            "dataset_ref",
            "status"
        ],
        xavierKind: "infographic"
    },
    {
        name: "telemetry_event",
        label: "Evento telemetria",
        fields: [
            "event_type",
            "unit_id",
            "locale",
            "duration_ms",
            "instance_ref",
            "status"
        ],
        xavierKind: "telemetry_event"
    }
],
  aui: {
    enabled: true,
    allowAgentTheme: true,
  },
  // pay-per-use 5% + mesh-only gratis: 1 camion = 100 camiones mismo precio (solo consumo R2/D1/AI)
  // mesh-only: 0$ (datos P2P Yjs replicados en otros nodos gara-g sin Cloudflare)
  // payg: infra + AI con margen + handling (ver docs privados), sin fee por entidad
  billing: {
    tier: 'payg' as const, // 'free' | 'mesh-only' | 'payg' | 'payg-managed'
    mode: 'swal-managed' as const, // 'mesh-only' | 'self-managed' | 'swal-managed'
  },
} as const;
export type DomainConfig = typeof domainConfig;
