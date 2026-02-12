from . import kie
from . import wavespeed

class ProviderFactory:
    @staticmethod
    def get_provider(tier: str):
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
