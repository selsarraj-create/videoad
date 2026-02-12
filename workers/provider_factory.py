from . import kie
from . import wavespeed

class ProviderFactory:
    @staticmethod
    def get_provider(tier: str, model: str = None):
        # Explicit provider check based on model prefix or known list
        if model:
            if model.startswith("kling") or model.startswith("seedance") or model.startswith("wan"):
                return wavespeed
            if model.startswith("veo") or model.startswith("sora") or model.startswith("hailuo"):
                return kie
        
        # Fallback to tier-based default if model not specific
        if tier == "production":
            return wavespeed
        else:
            return kie

    @staticmethod
    def get_model_default(tier: str):
        if tier == "production":
            return "seedance-2.0-pro"
        else:
            return "veo-3.1-fast"
