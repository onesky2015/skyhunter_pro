import re

with open("frontend/components/CreateMonitorModal.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Add new imports
import_str = """import { DatePicker } from './DatePicker';
import { TimeRangeSlider } from './TimeRangeSlider';
import { AirlinePicker } from './AirlinePicker';
import { AlliancePicker } from './AlliancePicker';
import { TripTypeToggle } from './TripTypeToggle';
import { PassengerStepper } from './PassengerStepper';
import { CabinSelector } from './CabinSelector';
import { OriginDestInput } from './OriginDestInput';"""

text = re.sub(r"import \{ DatePicker \} from './DatePicker';.*?import \{ AlliancePicker \} from './AlliancePicker';", import_str, text, flags=re.DOTALL)

# 2. Trip Type
trip_type_re = r"\{/\* Trip Type \*/\}\s*<Text style=\{styles.label\}>Trip Type</Text>\s*<View style=\{styles.selector\}>.*?</View>"
text = re.sub(trip_type_re, "{/* Trip Type */}\n            <Text style={styles.label}>Trip Type</Text>\n            <TripTypeToggle tripType={tripType} onChange={setTripType} />", text, flags=re.DOTALL, count=1)

# 3. Origin & Destination
origin_dest_re = r"\{/\* Origin & Destination \*/\}\s*<View style=\{styles.row\}>.*?</View>\s*</View>"
text = re.sub(origin_dest_re, "{/* Origin & Destination */}\n            <OriginDestInput origin={origin} setOrigin={setOrigin} destination={destination} setDestination={setDestination} />", text, flags=re.DOTALL, count=1)

# 4. Cabin Selector
cabin_re = r"\{/\* Cabin Class \*/\}\s*<Text style=\{styles.label\}>Cabin Class</Text>\s*<View style=\{styles.selector\}>.*?</View>"
text = re.sub(cabin_re, "{/* Cabin Class */}\n            <Text style={styles.label}>Cabin Class</Text>\n            <CabinSelector value={cabinClass} onChange={setCabinClass} small />", text, flags=re.DOTALL, count=1)

# 5. Passenger Stepper
# Note: CreateMonitorModal uses string adults/children state, while search.tsx uses number.
# I need to ensure the PassengerStepper handles string conversion or change the state type in CreateMonitorModal.
# Looking at CreateMonitorModal.tsx:
# const [adults, setAdults] = useState('1');
# const [children, setChildren] = useState('0');
# PassengerStepper expectes value: number and onChange: (val: number) => void.
# So I should change the state to number or update the replacement to handle it.
# Let's change the state to number in CreateMonitorModal.tsx for consistency.

text = text.replace("const [adults, setAdults] = useState('1');", "const [adults, setAdults] = useState(1);")
text = text.replace("const [children, setChildren] = useState('0');", "const [children, setChildren] = useState(0);")

# Update useEffect prefill
text = re.sub(r"if \(prefillData.adults != null\) setAdults\(String\(prefillData.adults\)\);", "if (prefillData.adults != null) setAdults(prefillData.adults);", text)
text = re.sub(r"if \(prefillData.children != null\) setChildren\(String\(prefillData.children\)\);", "if (prefillData.children != null) setChildren(prefillData.children);", text)

# Update handleSubmit
text = re.sub(r"adults: parseInt\(adults\) \|\| 1,", "adults: adults || 1,", text)
text = re.sub(r"children: parseInt\(children\) \|\| 0,", "children: children || 0,", text)

# Update reset form
text = text.replace("setAdults('1');", "setAdults(1);") # I need to find where reset happens. It's in handleSubmit.
# Let's just regex the reset part too.
text = re.sub(r"setAdults\('1'\);", "setAdults(1);", text)
text = re.sub(r"setChildren\('0'\);", "setChildren(0);", text)

passenger_re = r"\{/\* Passengers \(Stepper\) \*/\}\s*<View style=\{styles.row\}>.*?</View>\s*</View>\s*</View>"
passenger_replacement = """{/* Passengers (Stepper) */}
            <View style={styles.row}>
              <PassengerStepper label="Adults" value={adults} onChange={setAdults} min={1} />
              <View style={{ width: 12 }} />
              <PassengerStepper label="Children" value={children} onChange={setChildren} />
            </View>"""
text = re.sub(passenger_re, passenger_replacement, text, flags=re.DOTALL, count=1)

with open("frontend/components/CreateMonitorModal.tsx", "w", encoding="utf-8") as f:
    f.write(text)

print("Refactored CreateMonitorModal.tsx component replacements")
