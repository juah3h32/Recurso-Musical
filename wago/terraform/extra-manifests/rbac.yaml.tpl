apiVersion: v1
kind: ServiceAccount
metadata:
  name: wago-api
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: wago-api-role
  namespace: default
rules:
  - apiGroups: ["apps"]
    resources: ["statefulsets"]
    resourceNames: ["waha"]
    verbs: ["get", "patch"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: wago-api-rolebinding
  namespace: default
subjects:
  - kind: ServiceAccount
    name: wago-api
    namespace: default
roleRef:
  kind: Role
  name: wago-api-role
  apiGroup: rbac.authorization.k8s.io
