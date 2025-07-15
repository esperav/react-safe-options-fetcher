import { debounce } from 'lodash';
import { useState, useRef, useEffect } from 'react';

const sortArray = arr => arr.sort((a, b) => a.label?.toString().localeCompare(b.label?.toString()));
const hasKeyword = (obj = {}, keyword = "") => keyword ? Object.values(obj).some(value => typeof value === 'string' && value?.toLowerCase().includes(keyword?.toLowerCase())) : obj;

/**
 * useSafeOptionsFetcher is a custom hook to fetch and filter options safely.
 * It handles API calls, local filtering, and manages loading states.
 * @APIService is the function to call the API
 * @customDataName is the name of the additional data to be used for filtering
 */

const useSafeOptionsFetcher = (APIService, customKey = "keyword", customPayload = undefined, customDataName = undefined) => {
  const [options, setOptions] = useState([]);
  const [filteredOptions, setFilteredOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchGuard = useRef({});
  const requestCounter = useRef(0);
  const getOptionsFromAPI = async (keyword = '') => {
    setIsLoading(true);
    const currentRequest = ++requestCounter.current;

    /** 
     * if @APIService is defined
     * if @searchGuard stop is false
     * if @keyword does not start with @searchGuard prevKeyword
     * proceed to call the api with @keyword as payload
     */
    if (APIService && (!searchGuard.current?.stop || !keyword.startsWith(searchGuard.current?.prevKeyword))) {
      const res = await APIService(!customPayload ? keyword : {
        [customKey]: keyword,
        ...customPayload
      });
      if (currentRequest !== requestCounter.current) return; // Race condition check

      if (res?.length > 0) {
        const merged = [...options, ...res];
        const unique = Array.from(new Map(merged.map(item => [item.value, item])).values());
        const sorted = sortArray(unique);
        const filtered = sorted.filter(ele => hasKeyword(customDataName ? ele[customDataName] : {
          value: ele.value,
          label: ele.label
        }, keyword));
        setOptions(sorted);
        setFilteredOptions(filtered);
        searchGuard.current = {};
      } else {
        /**
         * if no res to determine api call for the next keyword change
         * set @searchGuard stop to true
         * set @searchGuard prevKeyword value to @keyword
         */
        setFilteredOptions([]);
        searchGuard.current = {
          prevKeyword: keyword,
          stop: true
        };
      }
    }
    if (currentRequest === requestCounter.current) {
      setIsLoading(false);
    }
  };
  const filterOptionsLocally = (keyword = '') => {
    const matched = options.filter(ele => hasKeyword(customDataName ? ele[customDataName] : {
      value: ele.value,
      label: ele.label
    }, keyword));
    console.log('matched', matched, options);
    //if no option matched the keyword, fetch from api
    if (matched.length > 0) {
      setFilteredOptions(matched);
      setIsLoading(false);
      searchGuard.current = {};
    } else {
      if (!searchGuard.current?.stop || !keyword.startsWith(searchGuard.current?.prevKeyword)) {
        getOptionsFromAPI(keyword);
      }
    }
  };
  const getOptions = async (keyword = '') => {
    if (options.length > 0) {
      //filter options from already fetched if there are options
      filterOptionsLocally(keyword);
    } else {
      getOptionsFromAPI(keyword);
    }
  };
  const debouncedGetOptions = useRef(debounce((keyword = '') => {
    getOptions(keyword);
  }, 500)).current;
  useEffect(() => {
    return () => {
      debouncedGetOptions.cancel(); // prevent memory leaks
    };
    //eslint-disable-next-line
  }, []);
  return {
    optionFunction: {
      getOptions,
      //fetch options on change input
      debouncedGetOptions // fetch options on change keyword with 500ms delay
    },
    optionState: {
      options,
      filteredOptions,
      isLoading
    },
    optionsRef: {
      searchGuard
    }
  };
};

export { useSafeOptionsFetcher };
