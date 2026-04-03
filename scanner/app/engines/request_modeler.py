import copy
from urllib.parse import urlparse, parse_qs
from typing import Any, Dict, List


class RequestModeler:
    """Builds a structured, mutable model from normalized requests."""

    def build_model(self, request) -> Dict[str, Any]:
        headers = request.headers or {}
        auth_header_key = self._find_auth_header_key(headers)

        fields: List[Dict[str, Any]] = []
        body = request.body if isinstance(request.body, dict) else None
        if body is not None:
            fields.extend(self._extract_body_fields(body))

        fields.extend(self._extract_query_fields(request.url))

        return {
            'method': request.method,
            'url': request.url,
            'headers': copy.deepcopy(headers),
            'body': copy.deepcopy(body),
            'has_auth': bool(auth_header_key),
            'auth_header_key': auth_header_key,
            'fields': fields,
        }

    def _find_auth_header_key(self, headers: Dict[str, Any]):
        for key in headers.keys():
            if key.lower() == 'authorization':
                return key
        return None

    def _extract_body_fields(self, body: Dict[str, Any]) -> List[Dict[str, Any]]:
        fields: List[Dict[str, Any]] = []

        def walk(value: Any, path: List[Any]):
            if isinstance(value, dict):
                for k, v in value.items():
                    walk(v, path + [k])
            elif isinstance(value, list):
                # Model the list itself and first few members for mutation targets.
                fields.append({
                    'location': 'body',
                    'path': path,
                    'type': 'array',
                    'value': copy.deepcopy(value),
                })
                for i, item in enumerate(value[:3]):
                    walk(item, path + [i])
            else:
                fields.append({
                    'location': 'body',
                    'path': path,
                    'type': self._infer_type(value),
                    'value': value,
                })

        walk(body, [])
        return fields

    def _extract_query_fields(self, url: str) -> List[Dict[str, Any]]:
        fields: List[Dict[str, Any]] = []
        parsed = urlparse(url)
        params = parse_qs(parsed.query, keep_blank_values=True)

        for key, values in params.items():
            raw_value = values[0] if values else ''
            fields.append({
                'location': 'query',
                'path': [key],
                'type': self._infer_type(raw_value),
                'value': raw_value,
            })

        return fields

    def _infer_type(self, value: Any) -> str:
        if value is None:
            return 'null'
        if isinstance(value, bool):
            return 'boolean'
        if isinstance(value, int):
            return 'integer'
        if isinstance(value, float):
            return 'number'
        if isinstance(value, str):
            return 'string'
        if isinstance(value, list):
            return 'array'
        if isinstance(value, dict):
            return 'object'
        return 'unknown'
