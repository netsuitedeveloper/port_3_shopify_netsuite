//
// @title   Shopify new order import & set tranid, externalid
// @author  Hakuna Moni
// @version 1.0
// @date    15 Sep 2020
//

/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

define(["N/record", "N/log"], function (record, log) {
  function beforeSubmit(scriptContext) {
    if (scriptContext.type != "create") {
      log.debug({
        title: "do not run beforeSubmit",
        details: "type" + type,
      });
      return null;
    }
    log.debug({
      title: "beforeSubmit",
      details: "executing beforeSubmit",
    });
    var newRec = scriptContext.newRecord;
    var tranid = newRec.getValue({
      fieldId: "custbody_sh_order_num",
    });
    newRec.setValue({
      fieldId: "tranid",
      value: tranid,
    });
    var externalid = newRec.getValue({
      fieldId: "custbody_sh_order_id",
    });
    newRec.setValue({
      fieldId: "externalid",
      value: externalid,
    });
  }

  return {
    beforeSubmit: beforeSubmit,
  };
});
