import React, { useEffect } from 'react';
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from "use-places-autocomplete";
import { MapPin } from 'lucide-react';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Start typing address...",
  className = "",
  required = false
}: AddressAutocompleteProps) {
  const {
    ready,
    value: inputValue,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      /* Define search scope here */
      componentRestrictions: { country: "ca" }, // Restrict to Canada as per the app context
    },
    debounce: 300,
    defaultValue: value
  });

  // Sync with external value if it changes (e.g. on edit)
  useEffect(() => {
    if (value !== inputValue) {
      setValue(value, false);
    }
  }, [value]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    onChange(e.target.value);
  };

  const handleSelect = ({ description }: { description: string }) => () => {
    // When user selects a place, we can replace the keyword without request data from API
    setValue(description, false);
    clearSuggestions();
    onChange(description);
  };

  const renderSuggestions = () =>
    data.map((suggestion) => {
      const {
        place_id,
        structured_formatting: { main_text, secondary_text },
      } = suggestion;

      return (
        <li
          key={place_id}
          onClick={handleSelect(suggestion)}
          className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-100 last:border-0"
        >
          <div className="font-semibold text-slate-800">{main_text}</div>
          <div className="text-xs text-slate-500">{secondary_text}</div>
        </li>
      );
    });

  return (
    <div className="relative w-full">
      <input
        value={inputValue}
        onChange={handleInput}
        disabled={!ready}
        placeholder={placeholder}
        className={className}
        required={required}
      />
      {/* Suggestions dropdown */}
      {status === "OK" && (
        <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg mt-1 shadow-xl max-h-60 overflow-y-auto">
          {renderSuggestions()}
        </ul>
      )}
    </div>
  );
}
