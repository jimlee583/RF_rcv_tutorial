"""Pure-function RF calculation engine for the Receiver Lab backend.

Submodules:
    units       -- dB / dBm / linear conversions
    noise       -- thermal noise floor, SFDR, dynamic range helpers
    cascade     -- Friis NF, cascaded gain, cascaded IIP3/OIP3, cascade analysis
    mixer       -- frequency conversion and (illustrative) spur tables
    spectrum    -- two-tone IM3 / IM2 line generation and analyzer traces
    ip3curve    -- fundamental / IM3 output power curves for the IP3-SFDR plot
    defaults    -- illustrative default receiver configuration
"""
