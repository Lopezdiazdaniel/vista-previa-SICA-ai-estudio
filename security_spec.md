# SICA Security Specification & Firestore Rules Architecture

## 1. Data Invariants

1. **Service Integrity**: Services can only be modified by authenticated Administrators. Each service document must have a non-empty name (`nombre_cliente_o_lugar`) within 200 characters and valid status.
2. **User Identity & Role Guard**: Users collection holds sensitive credentials (`contrasena_hash`, PII). Direct write access is restricted. Regular users cannot alter their assigned role, status, or service assignment.
3. **Access Control Logs**: Access records must be attached to an existing, valid service and recording guard. Access documents are write-once or append-only.
4. **Logbook & Emergency Events**: Events with `tipo_evento: 'Emergencia'` or `nivel_prioridad: 'Emergencia'` notify supervisors in real-time. Only Supervisors and Admins may toggle `atendida_supervisor` and add supervisor notes.
5. **Consignas Integrity**: Consignas require start and end validity timestamps, target service, and must not exceed length constraints.
6. **Path Hardening**: All document keys must satisfy `isValidId()`.
7. **Timestamps & Auditing**: Timestamps must be validated to prevent retrospective backdating.

## 2. The "Dirty Dozen" Payloads (Adversarial Security Vectors)

1. **Privilege Escalation**: Non-admin user sending update with `rol: 'Administrador'` on `/usuarios/{userId}`.
2. **Orphan Access Record**: Access write containing non-existent or negative `id_servicio`.
3. **Ghost Field Injection**: Adding arbitrary undocumented properties such as `__bypass_security: true` to a service document.
4. **Denial of Wallet Payload**: Submitting a 500KB string payload into `nombre_visitante` on `/accesos`.
5. **Emergency Tampering**: Guard attempting to mark their own severe emergency as `atendida_supervisor: 1`.
6. **Impersonated Guard Access**: Submitting an access record where `id_guardia` differs from authenticated user token.
7. **Consigna Validity Inversion**: Consigna with `fecha_vigencia_fin` prior to `fecha_vigencia_inicio`.
8. **PII Scraping Attempt**: Unauthenticated or unauthorized user executing list query across entire `/usuarios` collection.
9. **SQL/NoSQL Injection in ID**: Document ID path variable formatted as `../../admin` or SQL command.
10. **Terminal State Reversal**: Changing an archived or deleted service record back to active without required admin privileges.
11. **Excessive Shift Duration**: Shift assignment spanning invalid years or infinite windows.
12. **Unvalidated File Document**: Adding an expediente document with illegal file extensions or missing user link.
