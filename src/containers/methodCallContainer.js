import React, { useContext, useCallback, useState, useEffect } from 'react';
import { NeedMethodMessage, NeedURLMessage, MethodCall } from '../components';
import { AppContext, LogContext } from '../context';
import Web3RpcCalls from '../helpers/web3Config';
import buildProvider from '../helpers/buildProvider';
import {
  fetchOrParseAbi,
  getFilteredMethods,
  getArgumentsFromMethodId,
  getContractFriendlyArguments,
} from '../helpers/contracts';
import { navigate, useParams } from '@reach/router';

const CONTRACT_FUNCTION_METHOD = 'eth_call';

const MethodCallContainer = () => {
  const params = useParams();
  const { codeSampleVisible, toggleSampleCode, abi, setAbi } = useContext(
    AppContext
  );
  const { addToLog } = useContext(LogContext);
  const logItem = useCallback(addToLog, []);

  const {
    web3URL = '',
    web3Lib = '',
    currentMethod = '',
    formArgs = '',
  } = params;

  const web3Method = Web3RpcCalls[currentMethod] || {};
  const { description, disabled } = web3Method || {};
  const { args: initialFormInputs, exec } = web3Method[web3Lib] || {};

  const [formInputs, setFormInputs] = useState([]);
  const [argumentList, setArgumentList] = useState([]);

  const updateURL = (val, index) => {
    const argsList = formArgs.split('/');
    argsList[index] = val;
    let joinedArgs = argsList.join('/');
    let url = `/${web3URL}/${web3Lib}/`;
    if (currentMethod) url += `${currentMethod}/`;
    if (formInputs.length > 0) url += `${joinedArgs}`;
    navigate(url);
  };

  const onUpdateContractMethod = () => {
    const methodId = argumentList[2];
    if (!methodId) return;
    const newFormInputs = getArgumentsFromMethodId(methodId);
    if (newFormInputs)
      setFormInputs([
        ...formInputs.slice(0, 3), // Discard existing method-specific inputs
        ...newFormInputs,
      ]);
    else setFormInputs([...formInputs.slice(0, 3)]);
  };

  const onUpdateArguments = async (val, index) => {
    if (currentMethod === CONTRACT_FUNCTION_METHOD) {
      if (index === 1) {
        // Prevent updating URL if ABI error
        const { error } = await fetchOrParseAbi(val);
        if (error)
          return logItem({
            method: 'error',
            data: ['🚨 Error:', error],
          });
        return updateURL(btoa(val), index);
      }
    }
    updateURL(val, index);
  };

  const onUpdateAbi = () => {
    const filteredMethods = getFilteredMethods(abi);
    const formInputsCopy = formInputs;
    formInputsCopy[2] = {
      ...formInputs[2],
      dropdownOptions: filteredMethods,
      disabled: abi.length === 1,
    };
    setFormInputs(formInputsCopy);
    if (abi.length === 1) updateURL(filteredMethods[0].value, 2);
  };

  const runRequest = () => {
    logItem({
      method: 'info',
      data: [`🚀 Sending request for **${currentMethod}**:`],
    });
    const [provider, proto] = buildProvider(web3Lib, atob(web3URL));
    let args = argumentList.slice();
    if (currentMethod === CONTRACT_FUNCTION_METHOD)
      // Pre-flight conversion for contract calls
      args = getContractFriendlyArguments(args, abi);
    exec(provider, proto, ...args)
      .then((response) => {
        logItem({
          method: 'info',
          data: [`✅ Node response:`, response],
        });
      })
      .catch((err) => {
        logItem({
          method: 'error',
          data: ['🚨 Error response:', err],
        });
      });
  };

  const loadURL = async () => {
    const list = formArgs.split('/');
    if (currentMethod === CONTRACT_FUNCTION_METHOD && list[1]) {
      // Load ABI
      try {
        list[1] = atob(list[1]);
        const { error, abi } = await fetchOrParseAbi(list[1]);
        if (error)
          return logItem({
            method: 'error',
            data: ['🚨 Error:', error],
          });
        setAbi(abi);
      } catch (e) {
        console.log(e);
      }
    }
    setArgumentList(list);
  };

  // Load URL arguments
  useEffect(() => {
    loadURL();
  }, [formArgs, currentMethod, formInputs]);

  useEffect(() => {
    if (!abi) return;
    onUpdateAbi();
  }, [abi, formInputs]);

  useEffect(() => {
    if (!argumentList) return;
    onUpdateContractMethod();
  }, [argumentList[2]]);

  useEffect(() => {
    if (!initialFormInputs) return;
    setFormInputs(initialFormInputs);
  }, [initialFormInputs]);

  const contextProps = {
    codeSampleVisible,
    toggleSampleCode,
    currentMethod,
    web3Lib,
    web3URL,
    description,
    disabled,
    args: formInputs,
    runRequest,
    onUpdateArguments,
    argumentList,
  };

  if (!web3URL) {
    return (
      <div className="w-3/12 py-2 px-4 border-r border-gray-200 shadow-md h-screen">
        <NeedURLMessage />
      </div>
    );
  }
  if (!currentMethod) {
    return (
      <div className="w-3/12 py-2 px-4 border-r border-gray-200 shadow-md h-screen">
        <NeedMethodMessage />
      </div>
    );
  }

  return <MethodCall {...contextProps} />;
};

export { MethodCallContainer };
