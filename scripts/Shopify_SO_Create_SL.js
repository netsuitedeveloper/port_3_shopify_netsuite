//
// @title   Shopify new order import
// @author  Hakuna Moni
// @version 1.0
// @date    12 Sep 2020
//

/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 */

var runDateTimeStr = "";
var event = "";
var section = "";
var fileID = "";
var shopifyOrderFolderID = "2916";
var lastDateFileDirectory = "Shopify Order Import/";

define([
  "N/file",
  "N/record",
  "N/search",
  "N/log",
  "N/error",
  "N/format",
], function (file, record, search, log, error, format) {
  function onRequest(context) {
    try {
      if (context.request.method === "POST") {
        var postDataStr = context.request.body;

        section = "Get running datetime";
        const runDateTime = new Date();
        runDateTimeStr = runDateTime.toString();
        log.debug({
          title: "runDateTimeStr:",
          details: runDateTimeStr,
        });

        section = "Save order json data to a file";
        var fileObjSave = file.create({
          name: runDateTimeStr + ".txt",
          fileType: file.Type.PLAINTEXT,
          contents: postDataStr,
          folder: shopifyOrderFolderID,
        });
        fileID = fileObjSave.save();
        log.debug({
          title: "fileID",
          details: fileID,
        });

        section = "Validate received post data with user & password";
        var postData = JSON.parse(postDataStr);
        if (postData.user != "hakunamoni" || postData.password != "qwer1234!") {
          log.error({
            title: section,
            details: "fileID" + fileID,
          });
          error_history(
            runDateTimeStr,
            fileID,
            "[event]" + event + "[section]" + section
          );
          return null;
        }
        event = postData.shopify_event ? postData.shopify_event : "";

        section = "Analyze shopify order info";
        var orderData = postData.data ? postData.data : null;
        if (!orderData) {
          log.error({
            title: section,
            details: "fileID" + fileID,
          });
          error_history(
            runDateTimeStr,
            fileID,
            "[event]" + event + "[section]" + section
          );
          return null;
        }
        var externalId = orderData.id ? orderData.id : null;
        var tranId = orderData.order_number ? orderData.order_number : null;
        var tranDate = orderData.created_at
          ? getFormattedDate(orderData.created_at)
          : null;
        var memo = orderData.note ? orderData.note : null;
        var status = orderData.fulfillment_status == "fulfilled" ? "F" : "B";
        log.debug({
          title: "tranDate",
          details: tranDate,
        });

        section = "Check sales order exists with same trandID";
        var existingOrderId = findSalesOrder(tranId);
        if (existingOrderId) {
          log.error({
            title: section,
            details: "fileID" + fileID,
          });
          error_history(
            runDateTimeStr,
            fileID,
            "[event]" + event + "[section]" + section
          );
          return null;
        }

        section = "Create sales order record";
        var soRec = record.create({
          type: record.Type.SALES_ORDER,
          isDynamic: true,
        });

        section = "Set sales order main body fields";
        if (tranId) {
          soRec.setValue({
            fieldId: "custbody_sh_order_num",
            value: tranId,
          });
        }
        if (externalId) {
          soRec.setValue({
            fieldId: "custbody_sh_order_id",
            value: externalId,
          });
        }
        if (tranDate) {
          soRec.setValue({
            fieldId: "trandate",
            value: tranDate,
          });
        }
        if (memo) {
          soRec.setValue({
            fieldId: "memo",
            value: memo,
          });
        }
        if (status) {
          soRec.setValue({
            fieldId: "orderstatus",
            value: status,
          });
        }

        section = "Search Customer";
        var firstname = orderData.customer.first_name
          ? orderData.customer.first_name
          : null;
        var lastname = orderData.customer.last_name
          ? orderData.customer.last_name
          : null;
        if (!firstname || !lastname) {
          log.error({
            title: section,
            details: "fileID" + fileID,
          });
          error_history(
            runDateTimeStr,
            fileID,
            "[event]" + event + "[section]" + section
          );
          return null;
        }
        var customerID = findCustomer(firstname, lastname);
        if (!customerID) {
          var email = orderData.customer.email ? orderData.customer.email : "";
          var phone = orderData.customer.phone ? orderData.customer.phone : "";
          customerID = createCustomer(firstname, lastname, email, phone);
        }
        soRec.setValue({
          fieldId: "entity",
          value: customerID,
        });
        log.debug({
          title: "customerID",
          details: customerID,
        });

        section = "Set ShipTo Address";
        var shipAddr = orderData.shipping_address
          ? orderData.shipping_address
          : null;
        if (!shipAddr) {
          log.error({
            title: section,
            details: "fileID" + fileID,
          });
          error_history(
            runDateTimeStr,
            fileID,
            "[event]" + event + "[section]" + section
          );
          // return null;
        }
        soRec.setValue({
          fieldId: "shipaddresslist",
          value: null,
        });
        var shipToSubrecord = soRec.getSubrecord({
          fieldId: "shippingaddress",
        });
        shipToSubrecord.setValue({
          fieldId: "country",
          value: shipAddr.country_code,
        });
        shipToSubrecord.setValue({
          fieldId: "addressee",
          value: shipAddr.name,
        });
        shipToSubrecord.setValue({
          fieldId: "addr1",
          value: shipAddr.address1,
        });
        if (shipAddr.address2) {
          shipToSubrecord.setValue({
            fieldId: "addr2",
            value: shipAddr.address2,
          });
        }
        shipToSubrecord.setValue({
          fieldId: "city",
          value: shipAddr.city,
        });
        shipToSubrecord.setValue({
          fieldId: "state",
          value: shipAddr.province_code,
        });
        shipToSubrecord.setValue({
          fieldId: "zip",
          value: shipAddr.zip,
        });

        section = "Set BillTo Address";
        var billAddr = orderData.billing_address
          ? orderData.billing_address
          : null;
        if (!billAddr) {
          log.error({
            title: section,
            details: "fileID" + fileID,
          });
          error_history(
            runDateTimeStr,
            fileID,
            "[event]" + event + "[section]" + section
          );
          // return null;
        }
        soRec.setValue({
          fieldId: "billaddresslist",
          value: null,
        });
        var billToSubrecord = soRec.getSubrecord({
          fieldId: "billingaddress",
        });
        billToSubrecord.setValue({
          fieldId: "country",
          value: billAddr.country_code,
        });
        billToSubrecord.setValue({
          fieldId: "addressee",
          value: billAddr.name,
        });
        billToSubrecord.setValue({
          fieldId: "addr1",
          value: billAddr.address1,
        });
        if (billAddr.address2) {
          billToSubrecord.setValue({
            fieldId: "addr2",
            value: billAddr.address2,
          });
        }
        billToSubrecord.setValue({
          fieldId: "city",
          value: billAddr.city,
        });
        billToSubrecord.setValue({
          fieldId: "state",
          value: billAddr.province_code,
        });
        billToSubrecord.setValue({
          fieldId: "zip",
          value: billAddr.zip,
        });

        section = "Add Line Items";
        var skuCheck = true;
        for (var iItem = 0; iItem < orderData.line_items.length; iItem++) {
          var itemData = orderData.line_items[iItem];
          if (itemData.sku == "") {
            skuCheck = false;
            break;
          }
          var itemInternalId = findItemInternalId(itemData.sku);
          if (!itemInternalId) {
            skuCheck = false;
            break;
          }
          var qty = itemData.quantity;
          var rate = itemData.price;
          var amount = itemData.price_set.shop_money.amount;
          soRec.selectNewLine({
            sublistId: "item",
          });
          soRec.setCurrentSublistValue({
            sublistId: "item",
            fieldId: "item",
            value: itemInternalId,
          });
          soRec.setCurrentSublistValue({
            sublistId: "item",
            fieldId: "price",
            value: -1,
          });
          soRec.setCurrentSublistValue({
            sublistId: "item",
            fieldId: "quantity",
            value: qty,
          });
          soRec.setCurrentSublistValue({
            sublistId: "item",
            fieldId: "rate",
            value: rate,
          });
          soRec.setCurrentSublistValue({
            sublistId: "item",
            fieldId: "amount",
            value: amount,
          });
          soRec.commitLine({
            sublistId: "item",
          });
        }
        if (!skuCheck) {
          log.error({
            title: section,
            details: "fileID" + fileID,
          });
          error_history(
            runDateTimeStr,
            fileID,
            "[event]" + event + "[section]" + section
          );
          return null;
        }

        section = "Submit sales order record";
        soRec.setValue({
          fieldId: "location",
          value: 18,
        }); // sample value for testing
        var soID = soRec.save();
        log.debug({
          title: "soID",
          details: soID,
        });

        section = "Delete temp file";
        file.delete({
          id: fileID,
        });

        return true;
      }
    } catch (e) {
      var invalidDataErr = null;
      invalidDataErr = error.create({
        name: e.name,
        message: section + e.message,
      });
      error_history(
        runDateTimeStr,
        fileID,
        "[event]" + event + "[section]" + section + "[errorMsg]" + e.message
      );
      throw invalidDataErr;
    }
  }

  //Helpers
  function findSalesOrder(tranid) {
    section = "Helpers: findSalesOrder";
    var inputSearch = search.create({
      type: search.Type.SALES_ORDER,
      filters: [["mainline", "is", "F"], "and", ["tranid", "is", tranid]],
      columns: [
        // 'internalid'
      ],
    });
    var results = inputSearch.run().getRange({ start: 0, end: 1000 });
    if (results != null && results.length > 0) {
      return results[0].id;
    }
    return null;
  }

  function findCustomer(firstname, lastname) {
    section = "Helpers: findCustomer";
    var inputSearch = search.create({
      type: search.Type.CUSTOMER,
      filters: [
        ["isinactive", "is", "F"],
        "and",
        ["isperson", "is", "T"],
        "and",
        ["firstname", "is", firstname],
        "and",
        ["lastname", "is", lastname],
      ],
      columns: [
        // 'internalid'
      ],
    });
    var results = inputSearch.run().getRange({ start: 0, end: 1000 });
    if (results != null && results.length > 0) {
      return results[0].id;
    }
    return null;
  }

  function createCustomer(firstname, lastname, email, phone) {
    section = "Helpers: createCustomer";
    var custRec = record.create({
      type: "customer",
      isDynamic: true,
    });
    custRec.setValue({
      fieldId: "isperson",
      value: "T",
    });
    custRec.setValue({
      fieldId: "subsidiary",
      value: 2, // sample value for testing
    });
    custRec.setValue({
      fieldId: "custentityeb__province",
      value: "Test", // sample value for testing
    });
    custRec.setValue({
      fieldId: "firstname",
      value: firstname,
    });
    custRec.setValue({
      fieldId: "lastname",
      value: lastname,
    });
    if (email != "") {
      custRec.setValue({
        fieldId: "email",
        value: email,
      });
    }
    if (phone != "") {
      custRec.setValue({
        fieldId: "phone",
        value: phone,
      });
    }
    var custId = custRec.save();
    return custId;
  }

  function findItemInternalId(itemname) {
    section = "Helpers: findItemInternalId";
    var searchResultSet = search.create({
      type: search.Type.ITEM,
      filters: [["itemid", "is", itemname]],
      columns: [
        // 'internalid'
      ],
    });
    var results = searchResultSet.run().getRange({ start: 0, end: 1000 });
    if (results != null && results.length > 0) {
      return results[0].id;
    }
    return null;
  }

  function getFormattedDate(str) {
    section = "Helpers: getFormattedDate";
    var strArr1 = str.split("T");
    var strArr2 = strArr1[0].split("-");
    var strDate = strArr2[1] + "/" + strArr2[2] + "/" + strArr2[0];
    var dateTime = format.parse({ value: strDate, type: format.Type.DATE });
    return dateTime;
  }

  function error_history(timeStr, fileID, reason) {
    var logRec = record.create({
      type: "customrecord_sh_order_log",
      isDynamic: true,
    });
    if (timeStr != "") {
      logRec.setValue({
        fieldId: "custrecord_sh_log_date",
        value: timeStr,
      });
    }
    if (fileID != "") {
      logRec.setValue({
        fieldId: "custrecord_sh_log_file",
        value: fileID,
      });
    }
    logRec.setValue({
      fieldId: "custrecord_sh_log_reason",
      value: reason,
    });
    var logRecId = logRec.save();
    log.debug({
      title: "logRecId",
      details: logRecId,
    });
    return true;
  }

  return {
    onRequest: onRequest,
  };
});
