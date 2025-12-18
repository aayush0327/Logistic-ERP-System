"""
OpenTelemetry tracing configuration
"""
from opentelemetry import trace
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.propagate import set_global_textmap
from opentelemetry.propagators.b3 import B3MultiFormat
from functools import wraps
from typing import Callable


def init_tracer(service_name: str, jaeger_endpoint: str) -> None:
    """Initialize OpenTelemetry tracer with Jaeger exporter"""

    # Set up tracer provider
    resource = Resource.create({"service.name": service_name})
    tracer_provider = TracerProvider(resource=resource)

    # Set up Jaeger exporter
    jaeger_exporter = JaegerExporter(
        endpoint=jaeger_endpoint,
        collector_endpoint=jaeger_endpoint,
    )

    # Add span processor
    span_processor = BatchSpanProcessor(jaeger_exporter)
    tracer_provider.add_span_processor(span_processor)

    # Set global tracer provider
    trace.set_tracer_provider(tracer_provider)

    # Set up propagation
    set_global_textmap(B3MultiFormat())

    # Instrument libraries
    try:
        FastAPIInstrumentor().instrument()
        SQLAlchemyInstrumentor().instrument()
        RedisInstrumentor().instrument()
        HTTPXClientInstrumentor().instrument()
    except Exception as e:
        # Instruments might already be set up
        pass


def get_tracer(name: str) -> trace.Tracer:
    """Get a tracer instance"""
    return trace.get_tracer(name)


class TracingMixin:
    """Mixin to add tracing capabilities"""

    @property
    def tracer(self):
        """Get tracer instance for this class"""
        return get_tracer(f"{self.__class__.__module__}.{self.__class__.__name__}")

    def trace_function(self, name: str = None):
        """Decorator to trace a function"""

        def decorator(func):
            span_name = name or f"{self.__class__.__name__}.{func.__name__}"

            @wraps(func)
            async def wrapper(*args, **kwargs):
                with self.tracer.start_as_current_span(span_name) as span:
                    # Add function arguments as span attributes
                    for i, arg in enumerate(args):
                        if i == 0 and hasattr(arg, '__dict__'):
                            # Skip self argument
                            continue
                        span.set_attribute(f"arg.{i}", str(arg)[:100])

                    for key, value in kwargs.items():
                        span.set_attribute(f"arg.{key}", str(value)[:100])

                    try:
                        result = await func(*args, **kwargs)

                        # Add result summary to span
                        if hasattr(result, '__len__') and not isinstance(result, str):
                            span.set_attribute("result.count", len(result))

                        return result

                    except Exception as e:
                        # Add exception details to span
                        span.record_exception(e)
                        span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                        raise

            return wrapper

        return decorator


def add_span_attributes(attributes: dict) -> None:
    """Add attributes to current span"""
    span = trace.get_current_span()
    if span:
        for key, value in attributes.items():
            span.set_attribute(key, value)


def add_span_event(name: str, attributes: dict = None) -> None:
    """Add an event to current span"""
    span = trace.get_current_span()
    if span:
        span.add_event(name, attributes or {})