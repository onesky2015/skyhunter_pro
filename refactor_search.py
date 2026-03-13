import re

with open("frontend/app/(tabs)/search.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Add new imports
import_str = """import { DatePicker } from '../../components/DatePicker';
import { AdvancedFilters } from '../../components/AdvancedFilters';
import { CreateMonitorModal, MonitorPrefillData } from '../../components/CreateMonitorModal';
import { TripTypeToggle } from '../../components/TripTypeToggle';
import { PassengerStepper } from '../../components/PassengerStepper';
import { CabinSelector } from '../../components/CabinSelector';
import { OriginDestInput } from '../../components/OriginDestInput';"""
text = re.sub(r"import \{ DatePicker \} from '../../components/DatePicker';.*?import \{ CreateMonitorModal, MonitorPrefillData \} from '../../components/CreateMonitorModal';", import_str, text, flags=re.DOTALL)

# 2. Trip Type
trip_type_re = r"\{/\* Trip Type Toggle \*/\}.*?</View>"
text = re.sub(trip_type_re, "{/* Trip Type Toggle */}\n        <TripTypeToggle tripType={tripType} onChange={setTripType} />", text, flags=re.DOTALL, count=1)

# 3. Origin & Destination
origin_dest_re = r"\{/\* Origin & Destination \*/\}.*?</View>\s*</View>"
text = re.sub(origin_dest_re, "{/* Origin & Destination */}\n        <OriginDestInput origin={origin} setOrigin={setOrigin} destination={destination} setDestination={setDestination} />", text, flags=re.DOTALL, count=1)

# 4. Passenger Stepper
passenger_re = r"\{/\* Phase 2: Passenger Stepper \*/\}.*?</View>\s*</View>\s*</View>"
passenger_replacement = """{/* Phase 2: Passenger Stepper */}
        <View style={styles.passengerRow}>
          <PassengerStepper label="ADULTS" value={adults} onChange={setAdults} min={1} />
          <View style={{width: 12}} />
          <PassengerStepper label="CHILDREN" value={children} onChange={setChildren} />
        </View>"""
text = re.sub(passenger_re, passenger_replacement, text, flags=re.DOTALL, count=1)

# 5. Cabin Selector
cabin_re = r"\{/\* Phase 2: Cabin Selector \*/\}\s*<Text.*?>CABIN CLASS</Text>.*?<View style=\{styles.cabinRow\}>.*?</View>"
cabin_replacement = """{/* Phase 2: Cabin Selector */}
        <Text style={styles.inputLabel}>CABIN CLASS</Text>
        <CabinSelector value={cabinClass} onChange={setCabinClass} />"""
text = re.sub(cabin_re, cabin_replacement, text, flags=re.DOTALL, count=1)

# Remove the extracted styles
text = re.sub(r"\s*modeText: \{.*?\},\s*", "\n  ", text, flags=re.DOTALL)
text = re.sub(r"\s*modeTextActive: \{.*?\},\s*", "\n  ", text, flags=re.DOTALL)
text = re.sub(r"\s*inputRow: \{.*?\},\s*", "\n  ", text, flags=re.DOTALL)
# Removing too many styles might break things if shared, so let's just leave them or be careful.

with open("frontend/app/(tabs)/search.tsx", "w", encoding="utf-8") as f:
    f.write(text)

print("Refactored search.tsx component replacements")
